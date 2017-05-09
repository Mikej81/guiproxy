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


// BIG-IP Paths
bigKey = "/config/httpd/conf/ssl.key/server.key";
bigCert = "/config/httpd/conf/ssl.crt/server.crt";

banner = fs.readFileSync('./consent_banner.html').toString();

var key = fs.readFileSync(bigKey);
var cert = fs.readFileSync(bigCert);

const httpsServerOptions = {
	key: key,
	cert: cert,
	requestCert: true,
	rejectUnauthorized: false
};

const proxyOptions = {
	ssl: {
		key: key,
		cert: cert
	}, 
	target: 'https://127.0.0.1:444',
	secure: false
};

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

//Create 443 Proxy
var proxy = httpProxy.createServer();

//We need to get username from logon, so look for the BIGIPAuthUsernameCookie
var usernameCookie = "BIGIPAuthUsernameCookie";
//BIGIPAuthCookie=0BD6095556437BA7A5D7F9A786362FA5A690193E',
//BIGIPAuthUsernameCookie=xadmin'
//OtherName OID 1.3.6.1.4.1.311.20.2.3
var username;

var server = https.createServer(httpsServerOptions, function (req, res){

if (req.socket) {
	var uCert = req.socket.getPeerCertificate();
	var edipi;
	var certCN
	if (Object.prototype.toString.call(uCert.subject.CN) === '[object Array]') {
		certCN = uCert.subject.CN.join();
	} else {
		certCN = uCert.subject.CN;
	}

	var emailAddress = uCert.subject.emailAddress;

	var pem = forge.asn1.fromDer(uCert.raw.toString('binary'));
	var forgecert = pki.certificateFromAsn1(pem);
	var asn1Cert = pki.certificateToAsn1(forgecert);

	var subjectAlt = forgecert.getExtension({id: '2.5.29.17'});
	var jsonSubjectAlts = JSON.stringify(subjectAlt, true, 2);
	var parsedSubjectAlts = JSON.parse(jsonSubjectAlts);
	var keys = Object.keys(parsedSubjectAlts);
	
	var parsedEdipi = parsedSubjectAlts['value'].substr(parsedSubjectAlts['value'].toLowerCase().indexOf('@mil') - 10, 14);

	console.log(parsedEdipi);

	console.log(new Date() +' ' + req.connection.remoteAddress +' '+ edipi +' '+ req.method +' '+ req.url);
}

  var cookies = req.headers.cookie
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

	if (bannerCookie == -1) {
		proxy.web(req, res, bannerProxy);
	} else if (statsCookie == -1 && bigIPAuthCookie !== -1) {
	  proxy.web(req, res, statsProxyOptions);
	} else {
	  proxy.web(req, res, proxyOptions);
	}
  } else {
	proxy.web(req, res, bannerProxy);
  }
}).listen(443);

// Listen for the `error` event on `proxy`.
proxy.on('error', function (err, req, res) {
  res.writeHead(500, {
    'Content-Type': 'text/plain'
  });

  res.end('Something went wrong. And we are reporting a custom error message.');
});

//Section for Login Details Popup
function getUserStats(username) {
	var userstatscmd = shell.exec('tmsh show auth login ' + username, {silent:true}).stdout;
	return userstatscmd;
};

//Create Webserver with LoginStats
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

//Create Webserver with Clickthrough Banner
https.createServer(httpsServerOptions, function(req, res) {
  res.writeHead(200);
  res.end(banner);
}).listen(446);
