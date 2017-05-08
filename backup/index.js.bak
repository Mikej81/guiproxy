var http = require('http'),
	connect = require('connect'),
        https = require('https');

var httpProxy = require('http-proxy');

var fs = require('fs');
//const execa = require('execa');

var selects = [];
var simpleselect = {};

//Section for Login Details Popup
//var tmoslogstats = execa.stdout('tmsh', ['show auth login']);
var loginstats = '<script> function loginStats() { alert(\'stats\');}</script>';

simpleselect.query = '<head>';
simpleselect.func = function (node) {
	node.createWriteStream().end(loginstats);
}
selects.push(simpleselect);

//console.log(tmoslogstats);

// BIG-IP Paths
bigKey = "/config/httpd/conf/ssl.key/server.key";
bigCert = "/config/httpd/conf/ssl.crt/server.crt";

var key = fs.readFileSync(bigKey);
var cert = fs.readFileSync(bigCert);

var proxyOptions = {
        https: {
                key: key,
                cert: cert
        }
};

var guiProxy = httpProxy.createProxyServer({
        ssl: {
                key: key,
                cert: cert
        },
        target: 'https://127.0.0.1:444',
        secure: false
}).listen(443);

//We need to get username from logon, so look for the BIGIPAuthUsernameCookie
var usernameCookie = "BIGIPAuthUsernameCookie";
//BIGIPAuthCookie=0BD6095556437BA7A5D7F9A786362FA5A690193E',
//BIGIPAuthUsernameCookie=xadmin'
var username;

guiProxy.on('proxyReq', function(proxyReq, req, res, options) {
//	console.log(proxyReq._headers.cookie);
	var cookies = proxyReq._headers.cookie;
	var usearch = cookies.search(usernameCookie);
//	console.log(usearch);

	var cookiestring = cookies.substring(usearch).replace(usernameCookie + "=", '');

	console.log(cookiestring);


//	if (cookies.indexOf(usernameCookie)) {
//		console.log('fount it @ ' + cookies.indexOf(usernameCookie));
//		var bigipcookie = cookies[cookies.indexOf(usernameCookie)];
//       	//console.log(bigipcookie);
//	}

});

guiProxy.on('error', function (err, req, res) {
	res.writeHead(500, {
	 'Content-Type': 'text/plain'	
	});

	res.end('Something went wrong, please try again in a minute.');
});
