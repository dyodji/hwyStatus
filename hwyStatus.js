#!/usr/bin/env node

/**
 * Module dependencies.
 */

var express = require('express')
, jsdom = require('jsdom')
, request = require('request')
, url = require('url')
, chalk = require('chalk')
, http = require('http')
, fs = require("fs");

var path = "./lastStatus.json";
var bakPath = "./lastStatus.bak";
var hwyStatus = express();
var server = http.createServer();
var theUrl = 'http://www.dot.ca.gov/cgi-bin/roads.cgi?roadnumber=17+35+9&submit=Search';

request({uri: theUrl}, function(err, response, body){
  var self = this;
  self.items = new Array();
  	
  //Just a basic error check
  if(err && response.statusCode !== 200){console.log('Request error.');}

  //Send the body param as the HTML code we will parse in jsdom
  //also tell jsdom to attach jQuery in the scripts and loaded from jQuery.com
  jsdom.env({
  	html: body,
  	scripts: ['http://code.jquery.com/jquery-1.6.min.js'],
  	done:
		function(err, window){
			if(err){
				//textMe("ERROR: SUMMIN DUN GONE WRONG!", '8318189773@vtext.com');
				emailMe("ERROR: SUMMIN DUN GONE WRONG!", 'dyodji@gmail.com');
				//emailMe("ERROR: SUMMIN DUN GONE WRONG!", 'gstark@study.com');
			} else {
	
				//Use jQuery just as in a regular HTML page
				var $ = window.jQuery;
				var rte = "";
				var rtes = 0;
				var byRte = {};
				var newRte = true;
				
				var thisStatus = "";
				$("h3").nextUntil("hr").each(
					function() {
						var $self = $(this);
						var updates = $self.text().split("\n\n\n\n\n");
						if ($self.prev("h3").text() != "") {
							rtes++;
							rte =  $self.prev("h3").text().replace("\n","");
							newRte = true;
							if(rtes > 1) {thisStatus += "\n"}
							thisStatus += rte.trim() +":\n";
						} else {
							newRte = false;
						}
	
						if(rte.startsWith("SR")) {
							updates.forEach(function (upTxt) {
								upTxt = upTxt.replace(/\n/g,"").replace(/\s\s+/g, ' ').replace(" [IN THE CENTRAL CALIFORNIA AREA]","").trim();
								if(upTxt !== "") {
									thisStatus += "\t** " + upTxt + "\n";
								}
							});
						}
					}
				);
				
				var error = false;
				if(typeof thisStatus === "undefined" || thisStatus === ""){
					
					emailMe("thisStatus was blank, didn't get data from caltrans", 'dyodji@gmail.com');
					
				} else {
	
					var lastStatus = fs.readFileSync(path, 'utf8');
	
					console.log("THIS:\n" + chalk.green(thisStatus));
					console.log("LAST:\n" + chalk.red(lastStatus));
	
					if(lastStatus === "" || typeof lastStatus === "undefined"){
	
						emailMe("lastStatus was blank, didn't get data from caltrans", 'dyodji@gmail.com');
	
					} else {
	
						if(lastStatus === thisStatus){
							console.log("["+ new Date().toLocaleString()+"] " + chalk.red.bgWhite("NO CHANGE!!!"));
						} else {
							var lJson = parseResultToJson(lastStatus);
							var tJson = parseResultToJson(thisStatus);
							var additions = getListDiff(tJson,lJson);
							var removals = getListDiff(lJson,tJson);
							
							console.log("["+ new Date().toLocaleString() +"] " + chalk.blue.bgGreen("Oh Good God what now?! Tell the world!!"));
	
							console.log(getDiffText(additions, removals));
							var txtTxt = 'additions:' + additions.length + 'removals:' + removals.length + ' site: ' + theUrl
							var diffTxt = getDiffText(additions, removals);
							// parse contacts and tixt em
							var contactsFile = JSON.parse(fs.readFileSync('./contacts.json', 'utf8'));
							contactsFile.contacts.forEach( function (contact) {
								textMe(diffTxt, contact);
							});
						}
					}
					writeToLastStatus(thisStatus);
				}
			} // end err
		}
	});
});

function getDiffText(additions, removals) {
  
  var out = "ADDITIONS:\n";
  additions.forEach(function(element) {
    out += element +"\n\n";
  });
  
  out += "\n\nREMOVALS:\n";
  removals.forEach(function(element) {
    out += element +"\n\n";
  });
  
  return out;
}

// returns List of Status (Strings) which were in lookForStatuses but not in LookInStatuses 
function getListDiff(lookForStatuses, lookInStatuses) {
	var diffs = [];
	for (rte in lookForStatuses) {
		var arrayLength = lookForStatuses[rte].length;
		for (var i = 0; i < arrayLength; i++) {
			if(typeof lookInStatuses[rte] === "undefined" || !lookInStatuses[rte].includes(lookForStatuses[rte][i])){
				diffs.push(rte + ":" + lookForStatuses[rte][i])
			}
		}
	}
	return diffs;
}

function parseResultToJson(result) {
	var lines = result.split(/\r\n|\n/);
	var rte;
	var rtes = {};  
	var pattern = /^\s+\*/i
	// Reading line by line
	for(var line = 0; line < lines.length; line++){
		
		if (lines[line].startsWith("SR")){
		  rte = lines[line];
		  rtes[rte] = [];
		} else if (pattern.test(lines[line])) {
		  rtes[rte].push(lines[line])
		}
	};
	return rtes;
}

function writeToLastStatus(str) {
	fs.writeFile(path, str, function(error) {
		if (error) {
		   console.error("["+new Date().toLocaleString()+"] write error:  " + error.message);
		}
	});
}

function clearLastStatus() {
	fs.writeFileSync(bakPath, fs.readFileSync(path));
	clearLastStatus();
	fs.writeFile(path, "", function(error) {
		if (error) {
			console.error("["+new Date().toLocaleString()+"] write error:  " + error.message);
		}
	});
}

function textMe(str,to) {
	
	var creds = JSON.parse(fs.readFileSync("./creds.json", 'utf8'));
	var send = require('gmail-send')({
	  user: creds.user, // Your GMail account used to send emails
	  pass: creds.pass, // Application-specific password
	  to:   to,	  // Send back to yourself 
	  subject: 'HwyStsAlrt: Smn dn chgd!',
	  text:	str
	});
		 
	// Override any default option and send email 
	send({						 
		subject: 'HwyStsAlrt: Smn dn chgd!',   // Override value set as default
	}, function (err, res) {
		console.log('['+new Date().toLocaleString()+'] [tixting: '+to+'] [msg: '+ str +'] err:', err, '; res:', res);
	});
}

function emailMe(str, to) {
	textMe(str + "\n\nVIA: " + theUrl, to)
}
