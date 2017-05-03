process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

var http = require('http'),
	connect = require('connect'),
        https = require('https');

var httpProxy = require('http-proxy');

var fs = require('fs');
var shell = require('shelljs');

var zlib = require('zlib');

// Replacement XUI.JS File
var xuiJS = fs.readFileSync("./xui.js", "utf8");

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

var httpsAgent = new https.Agent({
	"key": key,
	"cert": cert
});

var httpsCreds = {
	key: key,
	cert: cert,
	requestCert: false,
	rejectUnauthorized: false
};

var guiProxy = httpProxy.createProxyServer({
        ssl: {
                key: key,
                cert: cert
        },
	agent: httpsAgent,
        target: 'https://127.0.0.1:444',
        secure: false
}).listen(443);

function modHTML(body, script) {
    // Add or script to the page
    if(body.indexOf('</body>') > -1 ) {
        str = body.replace('</body>', script + '</body>');
    } else if ( body.indexOf('</html>') > -1 ){
        str = body.replace('</html>', script + '</html>');
    } else {
        body = body + script;
    }

    return body;
};


//We need to get username from logon, so look for the BIGIPAuthUsernameCookie
	var usernameCookie = "BIGIPAuthUsernameCookie";
//BIGIPAuthCookie=0BD6095556437BA7A5D7F9A786362FA5A690193E',
//BIGIPAuthUsernameCookie=xadmin'
	var username;

guiProxy.on('proxyReq', function(proxyReq, req, res, options) {});

//Section for Login Details Popup
function getUserStats(username) {
	var userstatscmd = shell.exec('tmsh show auth login ' + username, {silent:true}).stdout;
	return userstatscmd;
};

var proxyResponse = guiProxy.on('proxyRes', function(proxyRes, req, res) {
//console.log('proxyRes');
	var output = "";
        var body = "";
        var newbody = "";
        var count = 0;
        var chunks;
        var deflatedbuf = [];
        var gunzip = zlib.Gunzip();
        var _writeHead = res.writeHead;

	var _write = res.write;
	var cookies = proxyRes.headers['set-cookie'];
	var cookiestring;
	var uName;
	var userloginstats;
	var contentEncoding = proxyRes.headers['content-encoding'];

          // Strip off the content encoding since it will change.
//          res.removeHeader('Content-Encoding');

//	  _writeHead.apply(this, arguments);

	if (cookies) {
                var usearch = cookies.toString().search(usernameCookie);
                cookiestring = cookies.toString().substr(usearch).replace(usernameCookie + "=", '');
		uName = cookiestring.substr(0, cookiestring.indexOf(';'));
                userloginstats = getUserStats(uName);
        }
	
//	var output = "";
//	var body = "";
//	var newbody = "";
//	var count = 0;
//	var chunks;
//	var deflatedbuf = [];
//	var gunzip = zlib.Gunzip();
//	var _writeHead = res.writeHead;

	var script = '<script type="text/javascript">function coleman() { alert("DIE!"); }</script>';

	if ((req.url.indexOf('/xui/') > -1) && 
		(typeof uName != 'undefined') && 
			(req.url.length <= 5)) {
//		console.log("xui and User Authed: " + uName + " Count: " + count);
//		console.log(contentEncoding);
		proxyRes.on('data', function(data) {
			gunzip.write(data);
		});

		gunzip.on('data', function(data) {
			//console.log('gunzip!');
			deflatedbuf.push(data.toString());
		}).on('end', function() {
			deflatedbuf = deflatedbuf.join("");
		}).on('error', function(e) {
			console.log(e);
		});
		res.end = function(data, encoding) {
                	if (contentEncoding.toLowerCase() == 'gzip'){
                        	gunzip.end(data);
                	}
		};
//		res.setHeader('transfer-encoding', '');
//		delete proxyRes.headers['content-encoding'];
//		res.setHeader('cache-control', 'no-cache');
//		_writeHead.apply(this, arguments);

		res.write = function(deflatedbuf, encoding) {
//			try {	
				bodyOut = body.toString('utf-8');
				output = modHTML(bodyOut, script);
				var gzipOut;
				zlib.gzip(output, function(error, result) {
					if (error) throw error;
					gzipOut = result;
				});
				//res.removeHeader('content-encoding');
				//_writeHead.apply(this, arguments);
				//res.write(res, gzipOut);
//			} catch(err) {
//				console.log("try catch err", err);
//			}
		}; 
	}

});

guiProxy.on('error', function (err, req, res) {
	res.writeHead(500, {
	 'Content-Type': 'text/plain'	
	});

	res.end('Something went wrong, please try again in a minute.' + err);
});
