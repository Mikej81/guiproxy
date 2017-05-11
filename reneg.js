//process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

var constants = require('constants');

var http = require('http'),
    https = require('https');

var forge = require('node-forge');
forge.options.usePureScript = true;
var pki = forge.pki;
var asn1 = forge.asn1;

var httpProxy = require('http-proxy');
var shell = require('shelljs');
var fs = require('fs');
var url = require('url');

//var ocsp = require('ocsp');
//var agent = ocsp.Agent;

//  LDAP Proxy
var ldap = require('ldapjs');
var ldapServer = ldap.createServer();

// BIG-IP Cert / Key Paths
bigKey = "/config/httpd/conf/ssl.key/server.key";
bigCert = "/config/httpd/conf/ssl.crt/server.crt";

// Read Cert / Key into Memory
var key = fs.readFileSync(bigKey);
var cert = fs.readFileSync(bigCert);

// Location of DoD Consent Banner html
banner = fs.readFileSync('./consent_banner.html').toString();

// Create HTTPS Server Options for Router 1
var httpsServerOptions = {
	key: key,
	cert: cert,
	agent: false,
	requestCert: false,
	rejectUnauthorized: false,
	secureOptions: constants.SSL_OP_NO_SSLv3 | constants.SSL_OP_NO_SSLv2
};

// Create HTTPS/TMUI Proxy Options
const proxyOptions = {
	ssl: {
		key: key,
		cert: cert
	},
	target: 'https://127.0.0.1:444',
	secure: false
};
// Create HTTPS Server Options for Router 2
const bannerProxy = {
	ssl: {
		key: key,
		cert: cert
	},
	target: 'https://127.0.0.1:446',
	secure: false
};

const statsProxyOptions = {
        ssl: {
		key: key,
                cert: cert
        },
	target: 'https://127.0.0.1:445',
        secure: false
};

//  Create Options for 'Step-Up' Cert Auth
const clientAuthOpts = {
	requestCert: true,
	rejectUnauthorized: false
};


//Create Proxy
var proxy = httpProxy.createServer();

//We need to get username from logon, so look for the BIGIPAuthUsernameCookie
var usernameCookie = "BIGIPAuthUsernameCookie";
//  Values to look out for:
//  BIGIPAuthCookie=0BD6095556437BA7A5D7F9A786362FA5A690193E',
//  BIGIPAuthUsernameCookie=xadmin'
//  OtherName OID 1.3.6.1.4.1.311.20.2.3
var username;

//Create HTTPS Server to be used as Proxy VIP, this is where the magic happens
var server = https.createServer(httpsServerOptions, function (req, res) {
	var cookies = req.headers.cookie;
	var socket = req.connection;

	//  HTTPS/TLS creates the socket
	if (cookies) {
		var bigIPAuthCookie = cookies.search('BIGIPAuthCookie');
		var userSearch = cookies.search(usernameCookie);
		var userCookie = cookies.substr(userSearch).replace(usernameCookie + "=", '');
		var statsCookie = cookies.search('LoginStatsAlert');
		var lowercaseUrl = req.url.toLowerCase();
		var bannerCookie = cookies.search('ConsentBanner');
		if (userCookie.indexOf(';') !== -1) {
			username = userCookie.substr(0, userCookie.indexOf(';'));
		} else {
			username = userCookie;
		}

		//  Present Click Through Banner First, No matter what else
		//  
		var haveUserCert;

		if (bannerCookie == -1) {
			proxy.web(req, res, bannerProxy);
		} else if (statsCookie == -1 && bigIPAuthCookie !== -1) {
			//  Show the User Logon Stats.
			proxy.web(req, res, statsProxyOptions);
		} else {
			if (req.socket.getPeerCertificate().raw === undefined) { haveUserCert = false; } else { haveUserCert = true;  }

			if (bannerCookie && (haveUserCert == false)) {
				console.log('no cert, reneg');
				haveUserCert = false;
				var renegotiate = req.socket.renegotiate(clientAuthOpts, function(err) {
					if (err) {
						console.log(err);
					}
				haveUserCert = true;
				});
			}
			proxy.web(req, res, proxyOptions);
		}

	} else {
		proxy.web(req, res, proxyOptions)
	}

	console.log(new Date() +' ' + req.connection.remoteAddress +' UNAUTHENTICATED_USER  '+ req.method +' '+ req.url);

}).listen(443);

// Listen for the `error` event on `proxy`.
proxy.on('error', function (err, req, res) {
  res.writeHead(500, {
    'Content-Type': 'text/plain'
  });

  res.end('Something went wrong. And we are reporting a custom error message.');
});

// Section for Login Details Popup
function getUserStats(username) {
	var userstatscmd = shell.exec('tmsh show auth login ' + username, {silent:true}).stdout;
	return userstatscmd;
};

// Create Webserver with LoginStats
// This is ugly, create an HTML with some class
https.createServer(httpsServerOptions, function(req, res) {
  res.writeHead(200);
	var outstring = "<html><head>";
	outstring += "<script>function setCookie(cname,cvalue) {";
	outstring += "var d = new Date();";
	outstring += "d.setTime(d.getTime() + (60*1000));";
	outstring += "var expires = \"expires=\" + d.toGMTString();";
	outstring += "document.cookie = cname + \"=\" + cvalue + \";\" + expires + \";path=/\"; ";
	outstring += "location.href = \"/\";}";
	outstring += "</script></head><body><form><table width=\"350\"><tr><td>" + getUserStats(username)  + "</tr></td>";
	outstring += "</table><input type=\"button\" value=\"OK\" id=\"submit\"";
	outstring += " onclick=\"setCookie('LoginStatsAlert', 'true')\"></form></body></html>";

  res.end(outstring);
}).listen(445);

// Create Webserver with Clickthrough Banner
https.createServer(httpsServerOptions, function(req, res) {
  res.writeHead(200);
  res.end(banner);
}).listen(446);
