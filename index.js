var http = require('http'),
	connect = require('connect'),
        https = require('https');

var httpProxy = require('http-proxy');

var fs = require('fs');
var shell = require('shelljs');

var selects = [];
var simpleselect = {};

simpleselect.query = '#alert';
simpleselect.func = function (node) {
	var out = '<script type="text/javascript">function coleman() {alert("oh no!");}</script>';

	var rs = node.createReadStream();
	var ws = node.createWriteStream({outer:false});

	rs.pipe(ws, {end: false});
	rs.on('end', function() {
		ws.end(out);
	});
	
}


//selects.push(simpleselect);

var app = connect();

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
});

app.use(require('harmon')([], selects));
app.use(function (req, res) {
	guiProxy.web(req, res, {target: 'https://127.0.0.1:444'});
});

https.createServer(httpsCreds, app, function(req, res) {
	console.log("req");
	console.log("res");

}).listen(443);

//We need to get username from logon, so look for the BIGIPAuthUsernameCookie
var usernameCookie = "BIGIPAuthUsernameCookie";
//BIGIPAuthCookie=0BD6095556437BA7A5D7F9A786362FA5A690193E',
//BIGIPAuthUsernameCookie=xadmin'
var username;

var proxyRequest = guiProxy.on('proxyReq', function(proxyReq, req, res, options) {
//	console.log(proxyReq);	
});

//Section for Login Details Popup
function getUserStats(username) {
	var userstatscmd = shell.exec('tmsh show auth login ' + username, {silent:true}).stdout;

	return userstatscmd;
};

var loginstats = '<script> function loginStats() { alert('+ username +');}</script>';

guiProxy.on('proxyRes', function(proxyRes, request, response) {
	var cookies = proxyRes.headers['set-cookie'];
	if (proxyRes.headers['content-type'] == 'text/html') {
		console.log("before: " + JSON.stringify(proxyRes.headers, true, 2));
	}
	//console.log("before: " + JSON.stringify(proxyRes.headers, true, 2));
	if (cookies) {
		var usearch = cookies.toString().search(usernameCookie);
		var cookiestring = cookies.toString().substr(usearch).replace(usernameCookie + "=", '');
		var userloginstats = getUserStats(cookiestring);
		//console.log(userloginstats);
	}
	if (proxyRes.headers['content-type'] == 'text/html' && proxyRes.headers['content-length']) {
		delete proxyRes.headers['content-length']
	}
	console.log("after: " + JSON.stringify(proxyRes.headers, true, 2));        
});

guiProxy.on('error', function (err, req, res) {
	res.writeHead(500, {
	 'Content-Type': 'text/plain'	
	});

	res.end('Something went wrong, please try again in a minute.' + err);
});
