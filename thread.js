var BSON = require('bson');
var db = null;
var arrPage = [];
var server_addr = 'https://www.openbsafes.com'
var cookie = '';
const axios = require('axios');

function connectToServer(url, postData)
{
	axios.post(url, postData, {withCredentials: true})
	.then((response) => {
	    //console.log('cookie', response.headers['set-cookie']);
	    cookie = response.headers['set-cookie'];
	    console.log('cookie', cookie);
	    console.log('res', response.data);
	    //downloadPages('db', 'p:mF_hRPgswTh1se8DuWy6762ojHUWOvn6dch4KIvaIo4flg=-1558941669974:1:1559177877327');
	})
	.catch(function (error) {
		console.log(error);
	});
}

function connectToServerWithKey(url, postData)
{
	axios.post(url, postData,  {headers: { Cookie: cookie }}, {withCredentials: true})
	.then((res) => {
	    //console.log('cookie', response.headers['set-cookie']);
	    console.log('res', res.data);
	    downloadPages('db', 'p:mF_hRPgswTh1se8DuWy6762ojHUWOvn6dch4KIvaIo4flg=-1558941669974:1:1559177877327');
	})
	.catch(function (error) {
		console.log(error);
	});
}





function dbSetDownloadStatusInTeam(teamId)
{
	var table = 'teams';
	db.run('UPDATE ' + table + ' SET isDownload = 1 WHERE teamId = ?', [pageID], function(err) {
		if (err) {
			return console.error(err.message);
		}
	});
}


function dbGetDownloadsListFromPages(fn)
{
	var table = 'pages';
	var sql = "SELECT pageId FROM " + table + " WHERE isDownload = 0";
	
	db.all(sql, function(err, rows) {
		if (err) {
			console.log(err)
		} else {
			rows.forEach(function (row) {  
				arrPage.push(row.pageId);
			})
		}
		fn();
	});
}

function dbSetDownloadedStatus(pageID, status)
{
	var table = 'pages';
	db.run('UPDATE ' + table + ' SET isDownload = ? WHERE pageID = ?', [status, pageID], function(err) {
		if (err) {
			return console.error(err.message);
		}
	});
}

//module.exports.downloadPages = downloadPages;
module.exports.connectToServer = connectToServer;
module.exports.connectToServerWithKey = connectToServerWithKey