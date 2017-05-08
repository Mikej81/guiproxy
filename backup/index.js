process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

var http = require('http'),
	connect = require('connect'),
        https = require('https');

var httpProxy = require('http-proxy');

var fs = require('fs');
var shell = require('shelljs');

var selects = [];
var simpleselect = {};

simpleselect.query = 'body';
simpleselect.func = function (node) {
	var out = '<loginstats label="Failed Logons since Last" />';
//	var out = '<div id="myAlert" style="display:none" class="alert alert-warning alert-dismissible" role="alert">';
//	out +=    '<button type="button" class="close" data-dismiss="alert" aria-label="Close">';
//      out +=	  '<span aria-hidden="true">&times;</span> </button>';
//	out +=    'Logon Stats</div>';

	var rs = node.createReadStream();
	var ws = node.createWriteStream({outer:false});

	rs.pipe(ws, {end: false});
	rs.on('end', function() {
		ws.end(out);
	});
	
}


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

app.use(require('harmon')([], selects));
app.use(function (req, res) {
var insert = '<script type="text/javascript">function coleman() { alert("") }</script>';
	if (req.url.indexOf('blank.html') > -1) {
		console.log('found blank.html @ ' + req.url);
		https.get('https://127.0.0.1:444/' + req.url, function(getres) {
			getres.pipe(modHTML(res, insert));	
		})
	}
		guiProxy.web(req, res, {target: 'https://127.0.0.1:444'});
});

https.createServer(httpsCreds, app, function(req, res) {}).listen(443);

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

var proxyResponse = guiProxy.on('proxyRes', function(proxyRes, req, res) {
	var cookies = proxyRes.headers['set-cookie'];
	if (cookies) {
                var usearch = cookies.toString().search(usernameCookie);
                var cookiestring = cookies.toString().substr(usearch).replace(usernameCookie + "=", '');
		var uName = cookiestring.substr(0, cookiestring.indexOf(';'));
                var userloginstats = getUserStats(uName);
        }
	
	var _write = res.write;
	var output = "";
	var body = "";
	var newbody = "";

	proxyRes.on('data', function(data) {
		if (proxyRes.headers['content-type'] === 'text/xml'){
                	data = data.toString('utf-8');
                	body += data;
			//var newbody = body.replace('</document>',"<loginstats label=\"" + userloginstats+ "\" user=\"" + uName + "\" />\r\n</document>");
			newbody = body.replace('</document>',"<loginstats label=\"userloginstats\" user=\"" + uName + "\" />\r\n");
			//newbody += "<alert label=\"Login\" id=\"100\" path=\"/\" details=\"LoginStats?\">\r\n";
			newbody += "</document>";
			//console.log(newbody);
		} else if (proxyRes.headers['content-type'] === 'text/javascript' && req.url.indexOf('xui.js') > -1) {
			data = data.toString('utf-8');
			body += data;
			newbody = xuiJS;
		}
	});
	var _end = res.end,
		chunks,
			_writeHead = res.writeHead;


//	if (proxyRes.headers['content-type'] == 'text/html' && proxyRes.headers['content-length']) {
//		delete proxyRes.headers['content-length']
//	};

//	res.write = function(data, encoding) {
//		if (newbody && newbody.toString) {
//			_write.apply(newbody);
//			console.log('writing newbody: ', newbody);
//		} else {
//			_write.apply(res, arguments);
//			console.log('not writing new body');
//		}
//	};
});

guiProxy.on('error', function (err, req, res) {
	res.writeHead(500, {
	 'Content-Type': 'text/plain'	
	});

	res.end('Something went wrong, please try again in a minute.' + err);
});
