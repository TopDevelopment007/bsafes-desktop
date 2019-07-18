
var server_addr = 'https://www.openbsafes.com'
var forge = require('node-forge');
var ejse = require ("electron").remote.require('ejs-electron');
var BSON = require('bson');
var remote = require ("electron").remote;
var moment = require('moment');

function makeCallNavigate(link)
{
	var href = "javascript:navigateView('" + link + "')";
	//console.log(href);
	return href;
}

function navigateView(view)
{
	//console.log(view);

	const remote = require ("electron").remote;
	//const app = require('electron').remote.app
	const url = require('url');
	const path = require('path');
	//const ejse = require ("electron").remote.require('ejs-electron');

	if ( view.startsWith("/team/") ) {
		teamId = view.replace("/team/", "")
		view = 'team.ejs'
	} else if ( view.startsWith("/page/") ) {
		itemId = view.replace("/page/", "")
		view = 'page.ejs'
	} else if ( view.startsWith("/box/") ) {
		itemId = view.replace("/box/", "")
		view = 'box.ejs'
	} else if ( view.startsWith("/notebook/p/") ) {
		itemId = view.replace("/notebook/p/", "")
		view = 'notebookPage.ejs'
	} else if ( view.startsWith("/notebook/") ) {
		itemId = view.replace("/notebook/", "")
		view = 'notebook.ejs'
	} else if ( view.startsWith("/folder/p/") ) {
		itemId = view.replace("/folder/p/", "")
		view = 'folderPage.ejs'
	} else if ( view.startsWith("/folder/") ) {
		itemId = view.replace("/folder/", "")
		view = 'folder.ejs'
	} else if ( view.startsWith("/diary/p/") ) {
		itemId = view.replace("/diary/p/", "")
		view = 'diaryPage.ejs'
	} else if ( view.startsWith("/diary/") ) {
		itemId = view.replace("/diary/", "")
		view = 'diary.ejs'
	}

	switch (view) {
		case 'keyEnter.ejs' :
			ejse.data('redirectURL', 'teams.ejs')
			ejse.data('keyHint', 'keyHint')
			break;
		case 'team.ejs' :
			ejse.data('teamId', teamId)
			break;		
		case 'folder.ejs' :
		case 'box.ejs' :
		case 'notebook.ejs' :
		case 'diary.ejs' :
			ejse.data('initialDisplay', 'contents')
		case 'page.ejs' :
		case 'notebookPage.ejs' :		
		case 'folderPage.ejs' :	
		case 'diaryPage.ejs' :	
			ejse.data('itemId', itemId)			
			break;
		default :
			console.log('edi_error1')
			console.log(view)
			break;
	}


	const remote_win = remote.getCurrentWindow ();

	remote_win.loadURL(url.format({
	    pathname: path.join(__dirname, view),
	    protocol: 'file:',
	    slashes: true
	  }));

}

$('.btnBSafes').click(function(e) {

	// check whether keys existed in localstorage.
	if ( ("encodedGold" in localStorage) && ("publicKey" in localStorage) && ("encodedPrivateKeyEnvelope" in localStorage) && ("encodedEnvelopeIV" in localStorage)) {
		navigateView('../../BSafes/views/teams.ejs');
	} else {
		navigateView('../../BSafes/views/managedMemberSignIn.ejs');
	}
})

$('.btnLocal').click(function(e) {
	navigateView('../../Local/views/teams.ejs');
})

$('.btnDownloads').click(function(e) {
	navigateView('../../Downloads/views/downloads.ejs');
})

// database functions


function dbInsertDownloadList(itemId) // edi_ok
{
	db = remote.getGlobal('sqliteDB');
	var table = 'downloadList';

	var sql = "SELECT id FROM " + table + " WHERE itemId = ?";
	db.get(sql, itemId, function(err, row) {
		if (err) {
			console.log(err, 'dbInsertDownloadList');
		} else if (row == undefined) {
			db.run("INSERT INTO " + table + " (itemId) VALUES (?)", itemId);				
		} 
	});
}

function dbInsertTeamList(url, data) // edi_ok
{
	db = remote.getGlobal('sqliteDB');
	var blobData = BSON.serialize(data);
	var table = 'teamList';

	var sql = "SELECT id FROM " + table + " WHERE url = ?";
	db.get(sql, url, function(err, row) {
		if (err) {
			console.log('dbInsertTeamList', err)
		} else if (row == undefined) {
			db.run("INSERT INTO " + table + " (url, jsonData) VALUES (?, ?)", url, blobData);				
		} else {
			db.run("UPDATE " + table + " SET jsonData = ? WHERE id = ?", blobData, row.id);
		}
	});
}

function dbInsertTeams(url, teamId, data, isDownload=0) // edi_ok
{
	db = remote.getGlobal('sqliteDB');
	var blobData = BSON.serialize(data);
	var table = 'teams';

	var sql = "SELECT id FROM " + table + " WHERE url = ? AND teamId = ?";
	db.get(sql, [url, teamId], function(err, row) {
		if (err) {
			console.log('dbInsertTeams', err)
		} else if (row == undefined) {
			db.run("INSERT INTO " + table + " (url, teamId, jsonData, isDownload) VALUES (?, ?, ?, ?)", url, teamId, blobData, isDownload);				
		} else {
			db.run("UPDATE " + table + " SET jsonData = ?, isDownload = ? WHERE id = ?", blobData, isDownload, row.id);
		}
		console.log('dbInsertTeams', teamId);
	});
}

function dbUpdateDownloadStatusTeam(teamId) // edi_ok
{
	db = remote.getGlobal('sqliteDB');
	var table = 'teams';

	var sql = "SELECT id FROM " + table + " WHERE teamId = ?";
	db.get(sql, [teamId], function(err, row) {
		if (err) {
			console.log('dbUpdateDownloadStatusTeam', err)
		} else if (row == undefined) {
			console.log('dbUpdateDownloadStatusTeam', 'error: no team!!!')
		} else {
			db.run("UPDATE " + table + " SET isDownload = 1 WHERE id = ?", row.id);
		}
		console.log('dbInsertTeams', teamId);
	});
}

function dbInsertContainers(url, containerId, data, isDownload=0) // edi_ok
{
	db = remote.getGlobal('sqliteDB');
	var blobData = BSON.serialize(data);
	var table = 'containers';

	var sql = "SELECT id FROM " + table + " WHERE url = ? AND containerId = ?";
	db.get(sql, [url, containerId], function(err, row) {
		if (err) {
			console.log('dbInsertContainers', err)
		} else if (row == undefined) {
			db.run("INSERT INTO " + table + " (url, containerId, jsonData, isDownload) VALUES (?, ?, ?, ?)", url, containerId, blobData, isDownload);				
		} else {
			db.run("UPDATE " + table + " SET jsonData = ?, isDownload = ? WHERE id = ?", blobData, isDownload, row.id);
		}
		console.log('dbInsertContainers', containerId);
	});
}

function dbInsertPages(pageId) // edi_ok
{
	db = remote.getGlobal('sqliteDB');
	var table = 'pages';

	var sql = "SELECT id FROM " + table + " WHERE pageId = ?";
	db.get(sql, [pageId], function(err, row) {
		if (err) {
			console.log('dbInsertPages', err)
		} else if (row == undefined) {
			db.run("INSERT INTO " + table + " (pageId, isDownload) VALUES (?, ?)", pageId, 0);				
		} else {
			db.run("UPDATE " + table + " SET pageId = ?, isDownload = ? WHERE id = ?", pageId, 0, row.id);
		}
		console.log('dbInsertPages', pageId);
	});
}

function dbInsertPageContents(url, pageId, data) // edi_ok
{
	db = remote.getGlobal('sqliteDB');
	var table = 'pageContents';
	var blobData = BSON.serialize(data);

	var sql = "SELECT id FROM " + table + " WHERE url = ? AND pageId = ?";
	db.get(sql, [url, pageId], function(err, row) {
		if (err) {
			console.log('dbInsertPageContents', err);
		} else if (row == undefined) {
			db.run("INSERT INTO " + table + " (url, pageId, jsonData) VALUES (?, ?, ?)", url, pageId, blobData);				
		} else {
			db.run("UPDATE " + table + " SET jsonData = ? WHERE id = ?", blobData, row.id);
		}
		console.log('dbInsertPages', pageId);
	});
}

function dbInsertItemPath(url, itemId, data) // edi_ok
{
	db = remote.getGlobal('sqliteDB');
	var table = 'itemPath';
	var blobData = BSON.serialize(data);

	var sql = "SELECT id FROM " + table + " WHERE url = ? AND itemId = ?";
	db.get(sql, [url, itemId], function(err, row) {
		if (err) {
			console.log(err, 'dbInsertItemPath');
		} else if (row == undefined) {
			db.run("INSERT INTO " + table + " (url, itemId, jsonData) VALUES (?, ?, ?)", url, itemId, blobData);				
		} else {
			db.run("UPDATE " + table + " SET jsonData = ? WHERE id = ?", blobData, row.id);
		}
	});
}

function dbQueryTeamListSameAjax(ajaxUrl, postData, fn) {

	db = remote.getGlobal('sqliteDB');

	var sql =  "SELECT jsonData AS jd FROM teamList WHERE url = ?";
	db.get(sql, [ajaxUrl], function(err, row) {
		if (err) {
			console.log('dbQueryTeamListSameAjax', err)
		} else if (row == undefined) {
			console.log('no teams');
		} else {
			var blobData = row.jd;
			var data = BSON.deserialize(blobData);

			var sql =  "SELECT itemId FROM downloadList";
			db.all(sql, [], function(err, rows) {
				var out_hits = [];
				var arr_tmp = [];
				rows.forEach(function(row) {
					arr_tmp.push(row.itemId);
				});

				data.hits.hits.forEach(function(hit) {
					if (arr_tmp.includes(hit._source.teamId)) {
						out_hits.push(hit);
					}
				});
				data.hits.total = out_hits.length; 
				data.hits.hits = out_hits.slice(postData.from, postData.size + 1);
				//data.hits.total = arr_tmp.length;

				fn(data);
			});
				
			
		}
	});
	
}



function dbDeleteLogItem(itemID, fn)
{
	db = remote.getGlobal('sqliteDB');

	db.run('DELETE FROM logs WHERE itemID=?', itemID, function(err) {
		if (err) {
			return console.error('dbDeleteLogItem', err.message);
		}
		console.log('Row(s) deleted');
		fn();
	});
}

function dbAddDownloadsItemsInLogs(items)
{
	db = remote.getGlobal('sqliteDB');

	var sql = "INSERT INTO logs (itemName, itemID, position, status, total, downloaded, logTime) VALUES (?,?,?,?,?,?,?)";
	var stmt = db.prepare(sql);

	for(var i=0; i<items.length; i++) {
  		itemID = items[i].id;
  		position = items[i].position;
  		itemName = items[i].itemName;

  		nowTime = moment().format('YYYY-MM-DD hh:mm');

  		stmt.run(itemName, itemID, position, 'Calculating...', -1, 0, nowTime);
	}
    stmt.finalize();

}



function dbGetDownloadsItemsFromLogs(fn)
{
	db = remote.getGlobal('sqliteDB');
	var data = {} ;
	data.status = 'ok';
	data.hits = {}
	data.hits.hits = [];

	var sql = "SELECT itemName, itemID, position, status, total, downloaded, logTime FROM logs ORDER BY id DESC";
	
	db.all(sql, function(err, rows) {
		if (err) {
			console.log(err)
		} else {
			var count = 0;
			rows.forEach(function (row) {  
				count++;
				var team = {};
				team._source = {}
				team._source.teamId = row.itemID;
				team._source.position = row.position;
				team._source.teamName = row.itemName;
				team._source.status = row.status;
				team._source.logTime = row.logTime;

				data.hits.hits.push(team);
				data.hits.total = count;
			})

			fn(data);
		}
	});

}


function dbQueryItemListSameAjax(ajaxUrl, postData, fn) {

	db = remote.getGlobal('sqliteDB');
	var table = 'teams';

	var sql =  "SELECT jsonData AS jd FROM " + table + " WHERE teamId = ? AND url = ? ORDER By id DESC LIMIT 0, 1";

	db.get(sql, [postData.itemId, ajaxUrl], function(err, row) {
		if (err) {
			console.log(err, 'dbQueryItemListSameAjax')
		} else if (row == undefined) {
			console.log('no items');
		} else {
			var blobData = row.jd;
			data = BSON.deserialize(blobData);
			//var all_list = data.hits.hits;
			//data.hits.hits = all_list.slice(postData.from, postData.size);
			var sql =  "SELECT itemId FROM downloadList";
			db.all(sql, [], function(err, rows) {
				var out_hits = [];
				var arr_tmp = [];
				rows.forEach(function(row) {
					arr_tmp.push(row.itemId);
				});

				data.hits.hits.forEach(function(hit) {
					if (arr_tmp.includes(hit._id)) {
						out_hits.push(hit);
					}
				});
				data.hits.total = out_hits.length;
				data.hits.hits = out_hits.slice(postData.from, postData.size + 1);
				//data.hits.total = arr_tmp.length;

				fn(data);
			});
			
		}
	});	
}

function dbQueryGetItemData(ajaxUrl, postData, fn)
{
	db = remote.getGlobal('sqliteDB');
	var table = 'containers';

	var sql =  "SELECT jsonData AS jd FROM " + table + " WHERE url = ? AND containerId = ? ORDER By id DESC LIMIT 0, 1";

	db.get(sql, [ajaxUrl, postData.itemId], function(err, row) {
		if (err) {
			console.log(err, 'dbQueryGetItemData')
		} else if (row == undefined) {
			console.log('no items');
			var data = {status: "ok", item: null};
			fn(data);
		} else {
			var blobData = row.jd;
			var data = BSON.deserialize(blobData);			
			fn(data);
		}
	});
}

function dbQueryGetContainerContents(ajaxUrl, postData, fn)
{
	db = remote.getGlobal('sqliteDB');
	var table = 'containers';

	var sql =  "SELECT jsonData AS jd FROM " + table + " WHERE url = ? AND containerId = ? ORDER By id DESC LIMIT 0, 1";

	db.get(sql, [ajaxUrl, postData.itemId], function(err, row) {
		if (err) {
			console.log(err, 'dbQueryItemListSameAjax')
		} else if (row == undefined) {
			console.log('no items');
		} else {
			var blobData = row.jd;
			data = BSON.deserialize(blobData);
			//var all_list = data.hits.hits;
			//data.hits.hits = all_list.slice(postData.from, postData.size);
			var sql =  "SELECT itemId FROM downloadList";
			db.all(sql, [], function(err, rows) {
				var out_hits = [];
				var arr_tmp = [];
				rows.forEach(function(row) {
					arr_tmp.push(row.itemId);
				});

				data.hits.hits.forEach(function(hit) {
					if (arr_tmp.includes(hit._id)) {
						out_hits.push(hit);
					}
				});
				data.hits.total = out_hits.length;
				data.hits.hits = out_hits.slice(postData.from, postData.size + 1);
				//data.hits.total = arr_tmp.length;

				fn(data);
			});
			
		}
	});
}

function dbQueryGetPageItem(ajaxUrl, postData, fn) {

	db = remote.getGlobal('sqliteDB');
	var table = 'pageContents';

	var sql =  "SELECT jsonData AS jd FROM " + table + " WHERE url = ? AND pageId = ? ORDER By id DESC LIMIT 0, 1";

	db.get(sql, [ajaxUrl, postData.itemId], function(err, row) {
		if (err) {
			console.log(err, 'dbQueryGetPageItem')
		} else if (row == undefined) {
			console.log('no items');
			var data = {status: "ok", item: null};
			fn(data);
		} else {
			var blobData = row.jd;
			var data = BSON.deserialize(blobData);			
			fn(data);
		}
	});	
}


function dbQueryGetPageComments(ajaxUrl, postData, fn)
{
	db = remote.getGlobal('sqliteDB');
	var table = 'pageContents';

	var sql =  "SELECT jsonData AS jd FROM " + table + " WHERE url = ? AND pageId = ? ORDER By id DESC LIMIT 0, 1";

	db.get(sql, [ajaxUrl, postData.itemId], function(err, row) {
		if (err) {
			console.log(err, 'dbQueryPageSameAjax')
		} else if (row == undefined) {
			console.log('no items');
			var data = {status: "ok", item: null};
			fn(data);
		} else {
			var blobData = row.jd;
			var data = BSON.deserialize(blobData);		
			if (data.status === "ok") {
                var total = data.hits.total;
                var hits = data.hits.hits;
                data.hits.hits = data.hits.hits.slice(postData.from, postData.size + 1);
            }

			fn(data);
		}
	});

}

function dbQueryItemPath(ajaxUrl, postData, fn) {

	db = remote.getGlobal('sqliteDB');
	var table = 'itemPath';

	var sql =  "SELECT jsonData AS jd FROM " + table + " WHERE url = ? AND itemId = ? ORDER By id DESC LIMIT 0, 1";

	db.get(sql, [ajaxUrl, postData.itemId], function(err, row) {
		if (err) {
			console.log(err, 'dbQueryItemPath')
		} else if (row == undefined) {
			console.log('no items');
			var data = {status: "ok", item: null};
			fn(data);
		} else {
			var blobData = row.jd;
			var data = BSON.deserialize(blobData);			
			fn(data);
		}
	});	
}

function dbInsertInfo(url, data) 
{
	db = remote.getGlobal('sqliteDB');
	var blobData = BSON.serialize(data);

    var sql = "SELECT id FROM info WHERE url = ?";
	db.get(sql, url, function(err, row) {
		if (err) {
			console.log(err, 'dbInsertInfo')
		} else if (row == undefined) {
			db.run("INSERT INTO info (url, jsonData) VALUES (?, ?)", url, blobData);
		} else {
			db.run("UPDATE info SET jsonData = ? WHERE id = ?", blobData, row.id);
		}
	});
}

function dbQueryInfo(url, option, fn) 
{
	db = remote.getGlobal('sqliteDB');

	var sql =  "SELECT jsonData AS jd FROM info WHERE url = ? ORDER By id DESC LIMIT 0, 1";

	db.get(sql, [url], function(err, row) {
		if (err) {
			console.log(err, 'dbQueryInfo')
		} else if (row == undefined) {
			console.log('no items');
		} else {
			var blobData = row.jd;
			var data = BSON.deserialize(blobData);			
			
			fn(data);
		}
	});
}


function dbQueryGetTeamData(url, postdata, fn) 
{
	db = remote.getGlobal('sqliteDB');
	var table = 'teams';

	var sql =  "SELECT jsonData AS jd FROM " + table + " WHERE url = ? AND teamId = ? ORDER By id DESC LIMIT 0, 1";

	db.get(sql, [url, postdata.itemId], function(err, row) {
		if (err) {
			console.log('dbQueryGetTeamData', err)
		} else if (row == undefined) {
			console.log('no items');
		} else {
			var blobData = row.jd;
			data = BSON.deserialize(blobData);
			
			fn(data);
		}
	});
}