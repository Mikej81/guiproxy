process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

//We need to get username from logon, so look for the BIGIPAuthUsernameCookie
var usernameCookie = "BIGIPAuthUsernameCookie";
//BIGIPAuthCookie=0BD6095556437BA7A5D7F9A786362FA5A690193E',
//BIGIPAuthUsernameCookie=xadmin'
var username;
var uName;
var userloginstats;

var http = require('http'),
	connect = require('connect'),
        https = require('https');

var httpProxy = require('http-proxy');

var fs = require('fs');
var shell = require('shelljs');

var zlib = require('zlib');

// BIG-IP Paths
bigKey = "/config/httpd/conf/ssl.key/server.key";
bigCert = "/config/httpd/conf/ssl.crt/server.crt";

var key = fs.readFileSync(bigKey);
var cert = fs.readFileSync(bigCert);

var script = '<script type="text/javascript">function coleman() { alert("DIE!"); }</script>'

var selects = [];
var simpleselect = {};

simpleselect.query = 'body';
simpleselect.func = function (node) {
	var out = script;

	var rs = node.createReadStream();
	var ws = node.createWriteStream({outer:false});

	rs.pipe(ws, {end: false});
	rs.on('end', function() {
		ws.end(out);
	});
	
}
var app = connect();

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
});

app.use(require('harmon')([], selects));
app.use(function (req, res) {
		guiProxy.web(req, res, {target: 'https://127.0.0.1:444'});
});

https.createServer(httpsCreds, app, function(req, res) {}).listen(443);

guiProxy.on('proxyReq', function(proxyReq, req, res, options) {});

//Section for Login Details Popup
function getUserStats(username) {
	var userstatscmd = shell.exec('tmsh show auth login ' + username, {silent:true}).stdout;
	return userstatscmd;
};

var proxyResponse = guiProxy.on('proxyRes', function(proxyRes, req, res) {
	var cookies = proxyRes.headers['set-cookie'];
	var cookiestring;
	var contentEncoding = proxyRes.headers['content-encoding'];

	if (cookies) {
                var usearch = cookies.toString().search(usernameCookie);
                cookiestring = cookies.toString().substr(usearch).replace(usernameCookie + "=", '');
				if (typeOf uName == 'undefined') {
					uName = cookiestring.substr(0, cookiestring.indexOf(';'));
					userloginstats = getUserStats(uName);
				}
                
        }

	if ((req.url.indexOf('/xui/') > -1) && 
		(typeof uName != 'undefined') && 
			(req.url.length <= 5)) {
//		console.log("xui and User Authed: " + uName + " Count: " + count);
//		console.log(contentEncoding);

		}; 
	}

});

guiProxy.on('error', function (err, req, res) {
	res.writeHead(500, {
	 'Content-Type': 'text/plain'	
	});

	res.end('Something went wrong, please try again in a minute.' + err);
});
