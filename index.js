var fs = require('fs');
var exec = require('child_process').exec;

var hostname;
var hostcmd = "tmsh list sys global-settings hostname | grep -oP \"hostname\\K.*\"";
var ipaddress;
var ipcmd = "tmsh list sys management-ip | grep -oP \"management-ip\\K.*\"";

function getshell(command, callback){
	exec(command, function(error, stdout, stderr){ callback(stdout); });
};

//hostname = exec("tmsh list sys global-settings hostname | grep -oP \"hostname\\K.*\"", function (error, stdout, stderr) {
//	console.log(stdout);
//});

//console.log(hostname);

//ipaddressProx = exec("tmsh list sys management-ip | grep -oP \"management-ip\\K.*\"", function(error, stdout, stderr) {
//	if (!error) {
//		ipaddress = + stdout;
//		console.log(stdout);
//	} else {
//		console.log(error);
//	}
//});

getshell(hostcmd);

var http = require('http'),
	connect = require('connect'),
        https = require('https');

var httpProxy = require('http-proxy');

// BIG-IP Paths
var bigKey = "/config/httpd/conf/ssl.key/server.key";
var bigCert = "/config/httpd/conf/ssl.crt/server.crt";

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
