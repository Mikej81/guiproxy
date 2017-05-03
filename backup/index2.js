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
var url = require('url');

// BIG-IP Paths
bigKey = "/config/httpd/conf/ssl.key/server.key";
bigCert = "/config/httpd/conf/ssl.crt/server.crt";

var key = fs.readFileSync(bigKey);
var cert = fs.readFileSync(bigCert);

var script = '<script type="text/javascript">alert("words!")</script>'
var overwrite = '<div id="alert" onload="$(this).text(\'Hello world in Div using text()\');"></div>';
var selects = [];
var simpleselect = {};

simpleselect.query = '#alert';
simpleselect.func = function (node) {
	var out = script;

	//var rs = node.createReadStream();
	//var ws = node.createWriteStream({outer:false});

	//rs.pipe(ws, {end: false});
	//rs.on('end', function() {
	//	ws.end(out);
	//});
	node.createWriteStream().end(overwrite);	
};

//selects.push(simpleselect);

var app = connect();

var proxyOptions = {
        https: {
                key: key,
                cert: cert
	 }};

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

app.use(require('./harmon2.js')([], selects));
app.use(function (req, res) {
	guiProxy.web(req, res, {target: 'https://127.0.0.1:444'});
});

https.createServer(httpsCreds, app, function(req, res) {
console.log('CreateServer: ' + req.url);
console.log('CreateServer: ' + uName);
console.log('CreateServer: ' + JSON.stringify(res.headers, true, 2));

// Create gzipped content
  var gzip = zlib.Gzip();
  var _write = res.write;  
  var _end = res.end;
  
  gzip.on('data', function(buf){
    _write.call(res, buf);
  });  
  gzip.on('end', function(){
    _end.call(res);
  });
  
  res.write = function(data){
    gzip.write(data);
  };  
  res.end = function(){
    gzip.end();
  };    
}).listen(443);

guiProxy.on('proxyReq', function(proxyReq, req, res, options) {});

//Section for Login Details Popup
function getUserStats(username) {
	var userstatscmd = shell.exec('tmsh show auth login ' + username, {silent:true}).stdout;
	return userstatscmd;
};

guiProxy.on('proxyRes', function(proxyRes, req, res) {
	var cookies = proxyRes.headers['set-cookie'];
	var cookiestring;
	var contentEncoding = proxyRes.headers['content-encoding'];
	var reqContentEncoding = req.headers['accept-encoding'];
	var gunzip = zlib.Gunzip();
	var buffer = [];
	var joinedBuff = [];

	if (cookies) {
                var usearch = cookies.toString().search(usernameCookie);
                cookiestring = cookies.toString().substr(usearch).replace(usernameCookie + "=", '');
				if ((uName == null) || ( uName == undefined)) {
					uName = cookiestring.substr(0, cookiestring.indexOf(';'));
					userloginstats = getUserStats(uName);
				}
                
        }
	var _end = res.end,
		chunks,
		_writeHead = res.writeHead;

	if (proxyRes.headers && proxyRes.headers['content-length'] &&
		(req.url.indexOf('/xui/') > -1) && (typeof uName != 'undefined') && 
			(req.url.length <= 5)) {
//			res.writeHead = function() {
//			  res.removeHeader('content-length');
//			  //res.removeHeader('content-encoding');
//			  res.removeHeader('transfer-encoding');
//			  //res.setHeader('cache-control', 'no-cache');
//			  _writeHead.apply(this, arguments);
//			};
//
//			proxyRes.on('data', function(data) {
//				//data += chunk;
//				if (contentEncoding.toLowerCase()== 'gzip'){
//					gunzip.write(data);
//				}
//			});
//			//proxyRes.on('end', function() {
//			//	res.end(data)
//			//});
//			gunzip.on('data', function(data) {
//				buffer.push(data.toString());
//				//console.log(data);
//			}).on('end', function() {
//				joinedBuff = buffer.join("");
//				console.log(joinedBuff.toString('utf-8'));
//			}).on('error', function(e) {
//				console.log(e);
//			});
//			console.log(joinedBuff.toString());
//			console.log("xui and User Authed: " + uName + " Count: " + count);						
	}

});

guiProxy.on('error', function (err, req, res) {
	res.writeHead(500, {
	 'Content-Type': 'text/plain'	
	});

	res.end('Something went wrong, please try again in a minute.' + err);
});
