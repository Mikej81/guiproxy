var http = require('http'),
	net = require('net'),
	express = require('express');
	connect = require('connect'),
        https = require('https');

var httpProxy = require('http-proxy');
var shell = require('shelljs');
var fs = require('fs');
var url = require('url');

//Do something to check for Username in a Cookie then adjust rules


// BIG-IP Paths
bigKey = "/config/httpd/conf/ssl.key/server.key";
bigCert = "/config/httpd/conf/ssl.crt/server.crt";

banner = fs.readFileSync('./consent_banner.html').toString();

var key = fs.readFileSync(bigKey);
var cert = fs.readFileSync(bigCert);

const httpsServerOptions = {
	key: key,
	cert: cert
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
var username;

var server = https.createServer(httpsServerOptions, function (req, res){
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

  //	console.log('Proxying GUI Requests for: ' + req.url);
  //	console.log('Request Headers ' + JSON.stringify(req.headers, true, 2));
  //	console.log('Request Cookies ' + JSON.stringify(req.headers.cookie, true, 2));
  //	console.log('Request UserName ' + req.headers.cookie.search("BIGIPAuthUsernameCookie"));
  //	console.log('Request Username ' + username);
  //	console.log('Requesting URL: ' + req.url);
  //	console.log('statsCookie' + statsCookie);
  //	(lowercaseUrl.indexOf('/xui/', req.url.length -5) !==-1)

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
