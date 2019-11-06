
var server_addr = 'https://www.openbsafes.com'
var forge = require('node-forge');
var BSON = require('bson');
var moment = require('moment');
//var remote = require ("electron").remote;

// database functions
var db = null;
if (require('electron').remote != undefined) {
	db = require('electron').remote.getGlobal('sqliteDB');
}

function setSQLiteDB(sqliteDB)
{
	db = sqliteDB;
}

function dbInsertDownloadList(itemId) // edi_ok
{
	//db =remote.getGlobal('sqliteDB');
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
	//db =remote.getGlobal('sqliteDB');
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
	//db =remote.getGlobal('sqliteDB');
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
		//console.log('dbInsertTeams', teamId);
	});
}

function dbUpdateDownloadStatusTeam(teamId) // edi_ok
{
	//db =remote.getGlobal('sqliteDB');
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
		//console.log('dbInsertTeams', teamId);
	});
}

function dbInsertContainers(url, containerId, data, isDownload=0) // edi_ok
{
	//db =remote.getGlobal('sqliteDB');
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
		//console.log('dbInsertContainers', containerId);
	});
}

function dbInsertPages(pageId) // edi_ok
{
	//db =remote.getGlobal('sqliteDB');
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
		//console.log('dbInsertPages', pageId);
	});
}

function dbSetContainerAndTeamOfPage(pageId, teamId, containerId)
{
	var table = 'pages';

	var sql = "SELECT id FROM " + table + " WHERE pageId = ?";
	db.get(sql, [pageId], function(err, row) {
		if (err) {
			console.log('dbSetContainerAndTeamOfPage', err);
			return;
		} else if (row) {
			db.run('DELETE FROM ' + table + ' WHERE id=?', row.id);
		}	
		db.run("INSERT INTO " + table + " (pageId, containerId, teamId) VALUES (?, ?, ?)", pageId, containerId, teamId);	
		//console.log('dbSetContainerAndTeamOfPage', pageId);
	});
}

function dbSetTotalCountersOfPage(pageId, type, counter)
{
	var table = 'pages';
	var field;
	if (type == 'ContentsImage') field = 'counterContentsImages';
	else if (type == 'Video') field = 'counterVideos';
	else if (type == 'Image') field = 'counterImages';
	else if (type == 'Attatchment') field = 'counterAttatchments';
	else if (type == 'OtherTypesContent') field = 'counterOtherTypesContents';

	var sql = "SELECT id FROM " + table + " WHERE pageId = ?";
	db.get(sql, [pageId], function(err, row) {
		if (err) {
			console.log('dbSetTotalCountersOfPage', err)
		} else if (row == undefined) {
			console.log('dbSetTotalCountersOfPage', 'err: not find pageId')
		} else {
			db.run("UPDATE " + table + " SET " + field + " = ? WHERE id = ?", [counter, row.id], function(err) {
			    if (err) {
			      console.log('err_dbSetTotalCountersOfPage', err.message);
			  	} 
			  	//console.log('dbSetTotalCountersOfPage', pageId, type, counter);
		    });
		}
		//console.log('dbSetTotalCountersOfPage', pageId, type, counter);
	});
	
}

function dbIncreaseDownloadedCountersOfPage(pageId, type, done)
{
	var table = 'pages';
	var field;
	if (type == 'ContentsImage') field = 'downloadedContentsImages';
	else if (type == 'Video') field = 'downloadedVideos';
	else if (type == 'Image') field = 'downloadedImages';
	else if (type == 'Attatchment') field = 'downloadedAttatchments';
	else if (type == 'OtherTypesContent') field = 'downloadedOtherTypesContents';

	var sql = "SELECT id FROM " + table + " WHERE pageId = ?";
	db.get(sql, [pageId], function(err, row) {
		if (err) {
			console.log('dbIncreaseDownloadedCountersOfPage', err)
		} else if (row == undefined) {
			console.log('dbIncreaseDownloadedCountersOfPage', 'err: not find pageId')
		} else {
			db.run("UPDATE " + table + " SET " + field + " = " + field + " + 1 WHERE id = ?", row.id);
		}
		done();
		//console.log('dbIncreaseDownloadedCountersOfPage', pageId);
	});
}

function dbCheckPageTotalCounters(pageId, done)
{
	var table = 'pages';
	var sql = "SELECT * FROM " + table + " WHERE pageId = ?";

	db.get(sql, [pageId], function(err, row) {
		if (err) {
			console.log('dbCheckPageTotalCounters', err)
		} else if (row == undefined) {
			console.log('dbCheckPageTotalCounters', 'err: not find pageId', pageId)
		} else {
			if ((row.counterContentsImages == -1) || (row.counterVideos == -1)
				|| (row.counterImages == -1) || (row.counterAttatchments == -1) || (row.counterOtherTypesContents == -1)) {
				done(false);
			} else {
				done(true);
			}
			
		}
	});
}

function dbCheckPageOnlyAttachment(pageId, done)
{
	var table = 'pages';
	var sql = "SELECT * FROM " + table + " WHERE pageId = ?";

	db.get(sql, [pageId], function(err, row) {
		if (err) {
			console.log('dbCheckPageTotalCounters', err)
		} else if (row == undefined) {
			console.log('dbCheckPageTotalCounters', 'err: not find pageId', pageId)
		} else {
			if ((row.counterContentsImages == -1) || (row.counterVideos == -1)
				|| (row.counterImages == -1) || (row.counterAttatchments == -1) || (row.counterOtherTypesContents == -1)) {
				done(false);
			} else {
				done(true);
			}
			
		}
	});
}

function dbUpdatePageStatus(pageId, done)
{
	var table = 'pages';
	var sql = "SELECT * FROM " + table + " WHERE pageId = ?";
	var error = null;
	var isCompleted = false;

	db.get(sql, [pageId], function(err, row) {
		if (err) {
			console.log('dbUpdatePageStatus', err)
			error = err;
		} else if (row == undefined) {
			console.log('dbUpdatePageStatus', 'err: not find pageId', pageId);
			error = 'err: not find pageId';
		} else {
			if (row.isDownload == -1) {
				// this means , this page is error.
				isCompleted = true;
			} else {
				if ((row.counterContentsImages > -1) && (row.counterVideos > -1)
					&& (row.counterImages > -1) && (row.counterAttatchments > -1) && (row.counterOtherTypesContents > -1)) {
					if ((row.counterContentsImages <= row.downloadedContentsImages) &&
						(row.counterVideos <= row.downloadedVideos) &&
						(row.counterImages <= row.downloadedImages) &&
						(row.counterAttatchments <= row.downloadedAttatchments) &&
						(row.counterOtherTypesContents <= row.downloadedOtherTypesContents)) { 

						db.run("UPDATE " + table + " SET isDownload = 1 WHERE id = ?", row.id);	
						isCompleted = true;
					} else {
						
					}	
				} else {	
					console.log('pageId = ', pageId);
					console.log('counterContentsImages', row.downloadedContentsImages, row.counterContentsImages);
					console.log('counterVideos', row.downloadedVideos, row.counterVideos);
					console.log('counterImages', row.downloadedImages, row.counterImages);
					console.log('counterAttatchments', row.downloadedAttatchments, row.counterAttatchments);
					console.log('counterAttatchments', row.downloadedOtherTypesContents, row.counterOtherTypesContents);
				}
			}
			
		}
		done(error, isCompleted, row);		
		//console.log('dbUpdatePageStatus', pageId);
	});
}

function dbCheckReadyAttachment(pageId, done)
{
	var table = 'pages';
	var sql = "SELECT * FROM " + table + " WHERE pageId = ?";
	var error = null;
	var isCompleted = false;

	db.get(sql, [pageId], function(err, row) {
		if (err) {
			console.log('dbUpdatePageStatus', err)
			error = err;
		} else if (row == undefined) {
			console.log('dbUpdatePageStatus', 'err: not find pageId')
			error = 'err: not find pageId';
		} else {
			if (row.isDownload == -1) {
				// this means , this page is error.
				isCompleted = true;
			} else {
				if ((row.counterContentsImages > -1) && (row.counterVideos > -1)
					&& (row.counterImages > -1) && (row.counterAttatchments > -1) && (row.counterOtherTypesContents > -1)) {
					if ((row.counterContentsImages <= row.downloadedContentsImages) &&
						(row.counterVideos <= row.downloadedVideos) &&
						(row.counterImages <= row.downloadedImages) &&
						// (row.counterAttatchments <= row.downloadedAttatchments) &&
						(row.counterOtherTypesContents <= row.downloadedOtherTypesContents)) { 

						//db.run("UPDATE " + table + " SET isDownload = 1 WHERE id = ?", row.id);	
						isCompleted = true;
					} else {
					}	
				} else {
					// console.log('counterContentsImages', pageId, row.counterContentsImages);
					// console.log('counterVideos', pageId, row.counterVideos);
					// console.log('counterImages', pageId, row.counterImages);
					// console.log('counterAttatchments', pageId, row.counterAttatchments);
				}
			}
			
		}
		done(error, isCompleted);
		
		//console.log('dbUpdatePageStatus', pageId);
	});
}

function dbUpdatePageStatusWithError(pageId)
{
	var table = 'pages';
	var sql = "SELECT * FROM " + table + " WHERE pageId = ?";
	var error = null;
	var isCompleted = false;

	db.get(sql, [pageId], function(err, row) {
		if (err) {
			console.log('dbUpdatePageStatusWithError', err)
			error = err;
		} else if (row == undefined) {
			console.log('dbUpdatePageStatusWithError', 'err: not find pageId')
			error = 'err: not find pageId';
		} else {
			db.run("UPDATE " + table + " SET isDownload = -1 WHERE id = ?", row.id);	
		}
		
		//console.log('dbUpdatePageStatusWithError', pageId);
	});
}

function dbInsertPageContents(url, pageId, data) // edi_ok
{
	//db = remote.getGlobal('sqliteDB');
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
		//console.log('dbInsertPageContents', pageId);
	});
}

function dbInsertPageOtherTypesContentFiles(url, pageId, s3Key, file_name) // edi_ok
{
	//db = remote.getGlobal('sqliteDB');
	var table = 'pageOtherTypesContentFiles';

	var sql = "SELECT id FROM " + table + " WHERE url = ? AND pageId = ? AND s3Key = ?";
	db.get(sql, [url, pageId, s3Key], function(err, row) {
		if (err) {
			console.log('dbInsertPageOtherTypesContent', err);
		} else if (row == undefined) {
			db.run("INSERT INTO " + table + " (url, pageId, s3Key, file_name) VALUES (?, ?, ?, ?)", url, pageId, s3Key, file_name);				
		} else {
			db.run("UPDATE " + table + " SET file_name = ? WHERE id = ?", file_name, row.id);
		}
		//console.log('dbInsertPageOtherTypesContent', pageId);
	});
}

function dbQueryFileInPageOtherTypesContentFiles(url, pageId, s3Key, fn) // edi_ok
{
	//db = remote.getGlobal('sqliteDB');
	var table = 'pageOtherTypesContentFiles';

	var sql = "SELECT file_name FROM " + table + " WHERE pageId = ? AND s3Key = ?";
	db.get(sql, [pageId, s3Key], function(err, row) {
		file_name = '';
		if (err) {
			console.log('dbQueryFileInPageOtherTypesContent', err);
		} else if (row == undefined) {
			err = 'undefined';
			console.log('dbQueryFileInPageOtherTypesContent', 'can not find file');
		} else {
			file_name = row.file_name;
			//fn(row.file_name);
		}
		//console.log('dbQueryFileInPageOtherTypesContent', pageId);
		fn(err, file_name);
	});
}

function dbInsertPageContentsFiles(url, pageId, s3Key, file_name) // edi_ok
{
	//db = remote.getGlobal('sqliteDB');
	var table = 'pageContentsFiles';

	var sql = "SELECT id FROM " + table + " WHERE url = ? AND pageId = ? AND s3Key = ?";
	db.get(sql, [url, pageId, s3Key], function(err, row) {
		if (err) {
			console.log('dbInsertPageContentsFiles', err);
		} else if (row == undefined) {
			db.run("INSERT INTO " + table + " (url, pageId, s3Key, file_name) VALUES (?, ?, ?, ?)", url, pageId, s3Key, file_name);				
		} else {
			db.run("UPDATE " + table + " SET file_name = ? WHERE id = ?", file_name, row.id);
		}
		//console.log('dbInsertPageContentsFiles', pageId);
	});
}

function dbQueryFileInPageContentsFile(url, pageId, s3Key, fn) // edi_ok
{
	//db = remote.getGlobal('sqliteDB');
	var table = 'pageContentsFiles';

	var sql = "SELECT file_name FROM " + table + " WHERE pageId = ? AND s3Key = ?";
	db.get(sql, [pageId, s3Key], function(err, row) {
		if (err) {
			console.log('dbQueryFileInPageContentsFile', err);
		} else if (row == undefined) {
			console.log('dbQueryFileInPageContentsFile', 'can not find file');
		} else {
			fn(row.file_name);
		}
		//console.log('dbQueryFileInPageContentsFile', pageId);
	});
}

function dbInsertPageVideo(url, pageId, s3Key, data='', file_name='') // edi_ok
{
	//db = remote.getGlobal('sqliteDB');
	var blobData = BSON.serialize(data);
	var table = 'pageVideos';

	var sql = "SELECT id FROM " + table + " WHERE url = ? AND pageId = ? AND s3Key = ?";
	db.get(sql, [url, pageId, s3Key], function(err, row) {
		if (err) {
			console.log('dbInsertPageVideo', err);
		} else if (row == undefined) {
			db.run("INSERT INTO " + table + " (url, pageId, s3Key, jsonData) VALUES (?, ?, ?, ?)", url, pageId, s3Key, blobData);				
		} else {
			db.run("UPDATE " + table + " SET file_name = ? WHERE id = ?", file_name, row.id);
		}
		//console.log('dbInsertPageVideo', pageId);
	});
}

function dbQueryDataInPageVideo(url, postData, fn) // edi_ok
{
	//db = remote.getGlobal('sqliteDB');
	var table = 'pageVideos';

	var sql = "SELECT jsonData AS jd, file_name FROM " + table + " WHERE url = ? AND pageId = ? AND s3Key = ?";
	db.get(sql, [url, postData.itemId, postData.s3Key], function(err, row) {
		if (err) {
			console.log('dbQueryDataInPageVideo', err);
		} else if (row == undefined) {
			console.log('dbQueryDataInPageVideo', 'can not find file');
		} else {
			var blobData = row.jd;
			data = BSON.deserialize(blobData);
			data.file_name = row.file_name;
			fn(data);
		}
		//console.log('dbQueryDataInPageVideo', postData.itemId);
	});
}

function dbInsertPageAttatchment(url, pageId, chunkIndex, s3KeyPrefix, data='', file_name='') // edi_ok
{
	//db = remote.getGlobal('sqliteDB');
	var blobData = BSON.serialize(data);
	var table = 'pageAttatchments';

	var sql = "SELECT id FROM " + table + " WHERE url = ? AND pageId = ? AND chunkIndex = ? AND s3KeyPrefix = ?";
	db.get(sql, [url, pageId, chunkIndex, s3KeyPrefix], function(err, row) {
		if (err) {
			console.log('dbInsertPageAttatchment', err);
		} else if (row == undefined) {
			db.run("INSERT INTO " + table + " (url, pageId, chunkIndex, s3KeyPrefix, jsonData) VALUES (?, ?, ?, ?, ?)", url, pageId, chunkIndex, s3KeyPrefix, blobData);				
		} else {
			db.run("UPDATE " + table + " SET file_name = ? WHERE id = ?", file_name, row.id);
		}
		//console.log('dbInsertPageAttatchment', pageId);
	});
}

function dbQueryDataInPageAttatchment(url, postData, fn) // edi_ok
{
	//db = remote.getGlobal('sqliteDB');
	var table = 'pageAttatchments';

	var sql = "SELECT jsonData AS jd, file_name FROM " + table + " WHERE url = ? AND pageId = ? AND chunkIndex = ? AND s3KeyPrefix = ?";
	db.get(sql, [url, postData.itemId, postData.chunkIndex, postData.s3KeyPrefix], function(err, row) {
		if (err) {
			console.log('dbQueryDataInPageAttatchment', err);
		} else if (row == undefined) {
			console.log('dbQueryDataInPageAttatchment', 'can not find file');
		} else {
			var blobData = row.jd;
			data = BSON.deserialize(blobData);
			data.file_name = row.file_name;
			fn(data);
		}
		//console.log('dbQueryDataInPageAttatchment', postData.itemId);
	});
}

function dbInsertPageIamge(url, pageId, s3Key, data='', file_name='') // edi_ok
{
	//db = remote.getGlobal('sqliteDB');
	var blobData = BSON.serialize(data);
	var table = 'pageImages';

	var sql = "SELECT id FROM " + table + " WHERE url = ? AND pageId = ? AND s3Key = ?";
	db.get(sql, [url, pageId, s3Key], function(err, row) {
		if (err) {
			console.log('dbInsertPageIamge', err);
		} else if (row == undefined) {
			db.run("INSERT INTO " + table + " (url, pageId, s3Key, jsonData) VALUES (?, ?, ?, ?)", url, pageId, s3Key, blobData);				
		} else {
			db.run("UPDATE " + table + " SET file_name = ? WHERE id = ?", file_name, row.id);
		}
		//console.log('dbInsertPageIamge', pageId);
	});
}

function dbQueryDataInPageIamge(url, postData, fn) // edi_ok
{
	//db = remote.getGlobal('sqliteDB');
	var table = 'pageImages';

	var sql = "SELECT jsonData AS jd, file_name FROM " + table + " WHERE url = ? AND pageId = ? AND s3Key = ?";
	db.get(sql, [url, postData.itemId, postData.s3Key], function(err, row) {
		if (err) {
			console.log('dbQueryDataInPageIamge', err);
		} else if (row == undefined) {
			console.log('dbQueryDataInPageIamge', 'can not find file');
		} else {
			var blobData = row.jd;
			data = BSON.deserialize(blobData);
			data.file_name = row.file_name;
			fn(data);
		}
		//console.log('dbQueryDataInPageIamge', postData.itemId);
	});
}

function dbInsertItemPath(url, itemId, data) // edi_ok
{
	//db = remote.getGlobal('sqliteDB');
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

	//db = remote.getGlobal('sqliteDB');
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
				//data.hits.hits = out_hits.slice(postData.from, postData.size + 1);
				data.hits.hits = out_hits.slice(postData.from, postData.from + postData.size);
				//data.hits.total = arr_tmp.length;

				fn(data);
			});
		}
	});
	
}

function dbDeleteLogItem(rowID, fn)
{
	//db = remote.getGlobal('sqliteDB');

	//db.run('DELETE FROM logs WHERE itemID=?', itemID, function(err) {
	db.run('DELETE FROM logs WHERE id=?', rowID, function(err) {
		if (err) {
			return console.error('dbDeleteLogItem', err.message);
		}
		console.log('Row(s) deleted');
		fn();
	});
}

function dbAddDownloadsItemsInLogs(items)
{
	//db = remote.getGlobal('sqliteDB');

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

function dbGetDownloadsItemsFromLogs(postData, fn)
{
	//db = remote.getGlobal('sqliteDB');
	var table = 'logs';
	var data = {} ;
	data.status = 'ok';
	data.hits = {}
	data.hits.hits = [];

	var sql;
	var total;

	sql = "SELECT count(id) as cnt FROM " + table;
	db.get(sql, [], function(err, row) {
		if (err) {
			console.log('err: dbGetDownloadsItemsFromLogs', err);
			fn(err);
		} else {
			total = row.cnt;
		}
	});

	sql = "SELECT id, itemName, itemID, position, status, total, downloaded, logTime FROM " + table + " ORDER BY id DESC LIMIT ?, ?";
	
	db.all(sql, [postData.from, postData.size], function(err, rows) {
		if (err) {
			console.log(err)
		} else {
			rows.forEach(function (row) {  
				var team = {};
				team._source = {}
				team._source.id = row.id;
				team._source.teamId = row.itemID;
				team._source.position = row.position;
				team._source.teamName = row.itemName;
				team._source.status = row.status;
				team._source.logTime = row.logTime;

				data.hits.hits.push(team);
				data.hits.total = total;
			})

			fn(data);
		}
	});

}


function dbQueryItemListSameAjax(ajaxUrl, postData, fn) {

	//db = remote.getGlobal('sqliteDB');
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
					} else {
						console.log(hit._id);
					}
				});
				data.hits.total = out_hits.length;
				//data.hits.hits = out_hits.slice(postData.from, postData.size + 1);
				data.hits.hits = out_hits.slice(postData.from, postData.from + postData.size);
				//data.hits.total = arr_tmp.length;

				fn(data);
			});
			
		}
	});	
}

function dbQueryGetItemData(ajaxUrl, postData, fn)
{
	//db = remote.getGlobal('sqliteDB');
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
	//db = remote.getGlobal('sqliteDB');
	var table = 'containers';

	var sql =  "SELECT jsonData AS jd FROM " + table + " WHERE url = ? AND containerId = ? ORDER By id DESC LIMIT 0, 1";

	db.get(sql, [ajaxUrl, postData.itemId], function(err, row) {
		if (err) {
			console.log(err, 'dbQueryGetContainerContents')
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

	//db = remote.getGlobal('sqliteDB');
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
	//db = remote.getGlobal('sqliteDB');
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

	//db = remote.getGlobal('sqliteDB');
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
	//db = remote.getGlobal('sqliteDB');
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
	//db = remote.getGlobal('sqliteDB');

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
	//db = remote.getGlobal('sqliteDB');
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

function dbGetDownloadsListFromPages(done)
{
	//db = require('electron').remote.getGlobal('sqliteDB');
	var table = 'pages';
	var sql = "SELECT pageId FROM " + table + " WHERE isDownload = 0";

	var arrPage = [];
	
	db.all(sql, function(err, rows) {
		if (err) {
			console.log(err)
		} else {
			rows.forEach(function (row) {  
				arrPage.push(row.pageId);
			})
		}
		done(arrPage);
	});
}

function dbGetDownloadedCountInItem(itemId, done)
{
	var table = 'pages';
	var sql = "SELECT pageId, containerId, teamId, isDownload FROM " + table + " WHERE pageId = ? OR containerId = ? OR teamId = ? ";

	db.all(sql, [itemId, itemId, itemId], function(err, rows) {
		if (err) {
			console.log(err, itemId);
			done(err, null, null);
		} else {
			var counter = 0;
			var downloaded = 0;
			var errors = 0;
			rows.forEach(function (row) {  
				counter++;
				if (row.isDownload == 1) {
					downloaded++;
				} else if (row.isDownload == -1) {
					errors++;
				} 
			})
			done(null, counter, downloaded, errors);
		}
		
	});
}