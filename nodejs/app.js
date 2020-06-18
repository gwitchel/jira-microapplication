var express = require('express'),
sys = require('sys'),
util = require('util'),
OAuth = require('oauth').OAuth,
fs = require('fs');
var path = require('path');

var app = module.exports = express.createServer()

app.configure('development', function() {
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
  app.use(express.logger());
  app.use(express.cookieParser());
  app.use(express.session({secret: "ssshhhh!"}));
});


var appDir = path.dirname(require.main.filename) + "/"
var configFile = appDir + "config.js"

var config = require(configFile);
var privateKeyData = fs.readFileSync(appDir+config["consumerPrivateKeyFile"], "utf8");
var consumer =  // create a new consumer 
  new OAuth(config['url'] + "plugins/servlet/oauth/request-token",
  				  config['url'] + "plugins/servlet/oauth/access-token",
                  config["consumerKey"],
                  "",
                  "1.0",
                  "http://localhost:8080/sessions/callback", //callback url
                  "RSA-SHA1",
				  null,
				  privateKeyData);

app.dynamicHelpers({
  	session: function(request, response){
    	return request.session;
	}
});

// onload get 
app.get('/', function(request, response){
  	response.send('Hello World');
});

app.get('/sessions/connect', function(request, response){ // connects to atlassian and begins auth process 
	consumer.getOAuthRequestToken(
		function(error, oauthToken, oauthTokenSecret, results) {
    		if (error) {
				console.log(error);
      			response.send('Error getting OAuth access token');
			}
    		else {
      			request.session.oauthRequestToken = oauthToken;
				  request.session.oauthRequestTokenSecret = oauthTokenSecret;
      			response.redirect(config['url'] + "plugins/servlet/oauth/authorize?oauth_token="+request.session.oauthRequestToken);
			}
		}
	)
});

app.get('/sessions/callback', function(request, response){ // after user has authenticated they are redirected to this callback containing the necessary information
	consumer.getOAuthAccessToken (
			request.session.oauthRequestToken, 
			request.session.oauthRequestTokenSecret, 
			request.query.oauth_verifier,
			function(error, oauthAccessToken, oauthAccessTokenSecret, results){			
				if (error) { 
					console.log(error.data);
					response.send("error getting access token");		
				}
    			else {
      				request.session.oauthAccessToken = oauthAccessToken;
      				request.session.oauthAccessTokenSecret = oauthAccessTokenSecret;
      				consumer.get(config['url'] + "rest/api/latest/issue/NUF-1.json", // change ticket to a different ticket
						request.session.oauthAccessToken, 
						request.session.oauthAccessTokenSecret, 
						"application/json",
						function(error, data, resp){
							console.log(data);
        					data = JSON.parse(data);
        					response.send("sucess" );
						}
					);
				}
			}
		)
	});
					
	app.get('/projects', function(request, response){
		consumer.get(config['url'] + "rest/api/latest/project", 
			request.session.oauthAccessToken, 
			request.session.oauthAccessTokenSecret, 
			"application/json",
			function(error, data, resp){
				data = JSON.parse(data);
				console.log(data);
				response.send("all projects: " + data);
			}
		);
	});
	app.get('/projects/:id', function(request, response){
		consumer.get(config['url'] + "rest/api/latest/project/" + request.params.id, 
			request.session.oauthAccessToken, 
			request.session.oauthAccessTokenSecret, 
			"application/json",
			function(error, data, resp){
				console.log(data);
				data = JSON.parse(data);
				response.send("Project with key ", request.params.id , ": ", data);
			}
		);
	});

	


app.listen(parseInt(process.env.PORT || 8080));