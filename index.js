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
var ldapClient = ldap.createClient({
	url: 'ldap://127.0.0.1:389'
});
var adldapClient = ldap.createClient({
	url: 'ldap://154.154.154.140'
});

var adminDN = 'CN=F5Audit,CN=Users,DC=f5lab,DC=com';
var baseDN = 'CN=Users,DC=f5lab,DC=com';
var nullDN = '';
var db = {};

ldapServer.bind('cn=root', function(req, res, next) {
	if (req.dn.toString() !== 'cn=root' || req.credentials !== 'secret')
		return next(new ldap.InvalidCredentialsError());

	console.log('bind DN: ' + req.dn.toString());
	console.log('bind PW: ' + req.credentials);

	res.end();
	return next();
});

ldapServer.search(baseDN, authorize, function(req, res, next) {
	console.log('base object: ' + req.dn.toString());
	console.log('scope: ' + req.scope);
	console.log('filter: ' + req.filter.toString());

	var dn = req.dn.toString();

	res.end();
	return next();
});

function authorize(req, res, next) {
  /* Any user may search after bind, only cn=root has full power */
  var isSearch = (req instanceof ldap.SearchRequest);
  if (!req.connection.ldap.bindDN.equals('cn=root') && !isSearch)
    return next(new ldap.InsufficientAccessRightsError());

  return next();
};

//Create an LDAP Server with Null Tree to accept any DN
ldapServer.bind(nullDN, function(req,res, next) {
	var dn = req.dn.toString();
	//BIND to actual AD to verify userPrincipalName matches x509 SubjectAltName
	//This would be tied to an F5 Query Account
	//how to pull from auth ldap system-auth u/p?
	adldapClient.bind(adminDN, 'pass@word1', function(err) {
		if (err) {
			console.log('AD Bind Error: ' + err);
		}
	});
	//Clean userPrincipalName out of dn, its needed to match DN syntax for LdapJS
	var searchDN;
	if (dn.toLowerCase().indexOf('userprincipalname') != -1) {
		searchDN = dn.toLowerCase().replace('userprincipalname', '');
	}
	var searchOptions = {
		scope: "sub",
		attributes: ['memberOf'],
		filter: "(userPrincipalName=" + searchDN + ")"
	};

	adldapClient.search(baseDN, searchOptions, function(err, res){
		if (err) {
			console.log(err);
		}
		res.on('searchEntry', function(entry) {
			console.log('entry: ' + JSON.stringify(entry.object));
		});
		res.on('searchReference', function(referral) {
			console.log('referral: ' + referral.uris.join());
		});
		res.on('error', function(err) {
			console.error('error: ' + err.message);
		});
		res.on('end', function(result) {
			console.log('status: ' + result.status);
			if (result.status === 0) {
				return next();
			} else {
				return next(new ldap.NoSuchObjectError);
			}
		});
	//Status Code Return 0 = success
	});

	res.end();
	return next();
});

ldapServer.listen(389, '127.0.0.1', function() {
	console.log('LDAP Server listening at %s', ldapServer.url);
});

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
var server = https.createServer(httpsServerOptions, function (req, res){
	var cookies = req.headers.cookie;
	var socket = req.connection;

	server.on('request', function(req,res){
		if (socket && cookies){
			var reqsocket = req.connection;
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
			//  Show the User Logon Stats.
				proxy.web(req, res, statsProxyOptions);
			} else {

                //  tls.getPeerCertificate.raw returns DER encoded buffer, this is a PITA
                //  x.509v3 extensions arent supported by anything, so work it...
                var uCert = reqsocket.getPeerCertificate();
                if (uCert == null) {
			var reneg = reqsocket.renegotiate(clientAuthOpts, function(err){
				if (!err) {
					console.log(req.connection.getPeerCertificate());
				} else {
					console.log(err.message);
				}
			});
                }

                var edipi;
                var certCN;

                //  Test CACs had some jumbled CN data, so lets mash it and strip it.
                if (Object.prototype.toString.call(uCert.subject.CN) === '[object Array]') {
                    certCN = uCert.subject.CN.join();
                } else {
                	certCN = uCert.subject.CN;
                }

                //  EDIPI is included in CN after users name.  BOB.BIG.BAD.867530901
				//  Lets strip that just incase EDIPI from SubjectAltName isnt available
				var edipi = certCN.substr(certCN.lastIndexOf('.') + 1, certCN.length) + '@MIL';

				//  Email address might come in handy...
				var emailAddress = uCert.subject.emailAddress;

				//  Node-Forge started to work after figuring our encoding
				//  Convert to raw DER to PEM for easier ASN1 conversion
				//  Also, incase it needs to be handed to OpenSSL Wrapper for any reason.
				var pem = forge.asn1.fromDer(uCert.raw.toString('binary'));
				var forgecert = pki.certificateFromAsn1(pem);
				var asn1Cert = pki.certificateToAsn1(forgecert);

				//  Nothing supports the WIndows UPN x.509v3 attribute, so start at the level above
				//  and take what we want.
				var subjectAlt = forgecert.getExtension({id: '2.5.29.17'});
				var jsonSubjectAlts = JSON.stringify(subjectAlt, true, 2);
				var parsedSubjectAlts = JSON.parse(jsonSubjectAlts);
				var keys = Object.keys(parsedSubjectAlts);

				var parsedEdipi = parsedSubjectAlts['value'].substr(parsedSubjectAlts['value'].toLowerCase().indexOf('@mil') - 10, 14);


					ldapClient.bind('userPrincipalName=f5audit', 'pass@word1', function(err) {
					if (err) {
						//  just for debug/test
						console.log('NewSeach: ' + err);
					}
					});

					//Tested Good Below
					ldapClient.bind(adminDN, 'pass@word1', function(err) {
					if (err) {
						console.log('f5 audit bind err: ' + err)
					}
					});
			
			proxy.web(req, res, proxyOptions);

			console.log(new Date() +' ' + req.connection.remoteAddress +' '+ edipi +' '+ req.method +' '+ req.url);
			}

		} else {
			proxy.web(req, res, bannerProxy);
			console.log(new Date() +' ' + req.connection.remoteAddress +' UNAUTHENTICATED_USER  '+ req.method +' '+ req.url);
		}
	});

//  HTTPS/TLS creates the socket
if (req.socket && cookies && 'this' === 'that') {
	// Grab all the cookies
	//var bigIPAuthCookie = cookies.search('BIGIPAuthCookie');
	//var userSearch = cookies.search(usernameCookie);
	//var userCookie = cookies.substr(userSearch).replace(usernameCookie + "=", '');
	//var statsCookie = cookies.search('LoginStatsAlert');
	//var lowercaseUrl = req.url.toLowerCase();
	//var bannerCookie = cookies.search('ConsentBanner');
    //if (userCookie.indexOf(';') !== -1) {
	//	username = userCookie.substr(0, userCookie.indexOf(';'));
    //} else {
	//	username = userCookie;
    //}
    //Present Click Through Banner First, No matter what else
    if (bannerCookie == -1) {
		proxy.web(req, res, bannerProxy);

	} else if (statsCookie == -1 && bigIPAuthCookie !== -1) {
		//  Show the User Logon Stats.
		proxy.web(req, res, statsProxyOptions);
	
	} else {
		//  Show user Logon Page or XUI
			var renegotiate = socket.renegotiate(clientAuthOpts, function(err) {
				console.log('tryna think but nothing happens');
				if (err) {
					console.log(err);
				} else {
					console.log('[renegotiate]');
				}
			});

                                //  tls.getPeerCertificate.raw returns DER encoded buffer, this is a PITA
                                //  x.509v3 extensions arent supported by anything, so work it...
                                //var uCert = req.socket.getPeerCertificate();
                                //var edipi;
                                //var certCN;

                                //  Test CACs had some jumbled CN data, so lets mash it and strip it.
                                //if (Object.prototype.toString.call(uCert.subject.CN) === '[object Array]') {
                                //        certCN = uCert.subject.CN.join();
                                //} else {
                                //        certCN = uCert.subject.CN;
                                //}

				//  EDIPI is included in CN after users name.  BOB.BIG.BAD.867530901
				//  Lets strip that just incase EDIPI from SubjectAltName isnt available
				//var edipi = certCN.substr(certCN.lastIndexOf('.') + 1, certCN.length) + '@MIL';

				//  Email address might come in handy...
				//var emailAddress = uCert.subject.emailAddress;

				//  Node-Forge started to work after figuring our encoding
				//  Convert to raw DER to PEM for easier ASN1 conversion
				//  Also, incase it needs to be handed to OpenSSL Wrapper for any reason.
				var pem = forge.asn1.fromDer(uCert.raw.toString('binary'));
				var forgecert = pki.certificateFromAsn1(pem);
				var asn1Cert = pki.certificateToAsn1(forgecert);

				//  Nothing supports the WIndows UPN x.509v3 attribute, so start at the level above
				//  and take what we want.
				var subjectAlt = forgecert.getExtension({id: '2.5.29.17'});
				var jsonSubjectAlts = JSON.stringify(subjectAlt, true, 2);
				var parsedSubjectAlts = JSON.parse(jsonSubjectAlts);
				var keys = Object.keys(parsedSubjectAlts);

				var parsedEdipi = parsedSubjectAlts['value'].substr(parsedSubjectAlts['value'].toLowerCase().indexOf('@mil') - 10, 14);

				//  tls.getPeerCertificate.raw returns DER encoded buffer, this is a PITA
				//  x.509v3 extensions arent supported by anything, so work it...
				//var uCert = req.socket.getPeerCertificate();
				//var edipi;
				//var certCN;

				//  Test CACs had some jumbled CN data, so lets mash it and strip it.
				//if (Object.prototype.toString.call(uCert.subject.CN) === '[object Array]') {
				//	certCN = uCert.subject.CN.join();
				//} else {
				//	certCN = uCert.subject.CN;
				//}

				// Now lets perform a bind to the LDAP-Proxy with the EDIPI data
				// future LDAP-Proxy will be used by BIG-IP to query user data
				// This will allow attribute query to be passed to real AD while initial BIND can
				// support random passwords.
				//ldapClient.bind('userPrincipalName=f5audit', 'pass@word1', function(err) {
				//	if (err) {
				//		//  just for debug/test
				//		console.log('NewSeach: ' + err);
				//	}
				//});

				//Tested Good Below
				//ldapClient.bind(adminDN, 'pass@word1', function(err) {
				//	if (err) {
				//		console.log('f5 audit bind err: ' + err)
				//	};
				//});
			//proxy.web(req, res, proxyOptions);
	}

	//var authHeader = new Buffer(parsedEdipi + ':' + '5unshin3' ).toString('base64');

//	var authPostOptions =	{
//		method:	'POST',
//		uri: 'https://127.0.0.1:444/login.jsp',
//		form: {
//			username: '',
//			passwd: ''
//		},
//		headers: {
//		'Authorization': 'Basic ' + authHeader}
//	};

	//console.log(new Date() +' ' + req.connection.remoteAddress +' '+ edipi +' '+ req.method +' '+ req.url);

	} else {
		proxy.web(req, res, bannerProxy);
		console.log(new Date() +' ' + req.connection.remoteAddress +' UNAUTHENTICATED_USER  '+ req.method +' '+ req.url);
  	}
  	//});
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
