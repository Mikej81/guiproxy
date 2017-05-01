var http = require('http'),
	connect = require('connect'),
        https = require('https');

var httpProxy = require('http-proxy');

var fs = require('fs');
var shell = require('shelljs');


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
	if (cookies) {

	var usearch = cookies.search(usernameCookie);

	var cookiestring = cookies.substring(usearch).replace(usernameCookie + "=", '');

	var userstats = getUserStats(cookiestring);
	}
});

//Section for Login Details Popup
function getUserStats(username) {
	var userstatscmd = shell.exec('tmsh show auth login ' + username, {silent:true}).stdout;

	return userstatscmd;
};

var loginstats = '<script> function loginStats() { alert("userstat");}</script>';

function modHtml(str) {
	if (str.indexOf('</head>') > -1) {
		str = str.replace('</head>', loginstats + '</head>');
	}
	return str;
}

guiProxy.on('proxyRes', function(proxyRes, request, response) {
	if (proxyRes.headers &&
        proxyRes.headers['content-type'] &&
        proxyRes.headers['content-type'].match('text/html')) {

        var _end = response.end,
            chunks,
            _writeHead = response.writeHead;

        response.writeHead = function(){
            if(proxyRes.headers && proxyRes.headers['content-length']){
                response.setHeader(
                    'content-length', (parseInt( proxyRes.headers['content-length'], 10 ) + loginstats.length) * 2);
            }
            // This disables chunked encoding
            response.setHeader( 'transfer-encoding', '' );

            // Disable cache for all http as well
            response.setHeader( 'cache-control', 'no-cache' );

            _writeHead.apply( this, arguments );
        };

        response.write = function( data ) {
            if( chunks ) {
                chunks += data;
            } else {
                chunks = data;
            }
        };

        response.end = function() {
            if( chunks && chunks.toString ) {
                _end.apply( response, [ modHtml( chunks.toString() ) ] );
            } else {
                _end.apply( response, arguments );
            }
        };
	}
});

guiProxy.on('error', function (err, req, res) {
	res.writeHead(500, {
	 'Content-Type': 'text/plain'	
	});

	res.end('Something went wrong, please try again in a minute.');
});
