var server_addr = 'https://www.openbsafes.com'
var download_folder_path = __dirname + '/bsafes_downloads/';
var forge = require('node-forge');
var BSON = require('bson');
var moment = require('moment');
const fs = require('fs');
const uuidv1 = require('uuid/v1');
const { ipcRenderer, remote } = require( "electron" );

var pki = forge.pki;
var rsa = forge.pki.rsa;
var privateKeyPem;
var arrPage = [];
var currentPage = null;
var stoppedPage = null;
var pageName = '';
var db = null;
var lastMsg = null;

var current_down_item = null;
var logObj = [];

var pageContentType = null;
var constContentTypeWrite = 'contentType#Write';
var constContentTypeDraw = 'contentType#Draw';
var constContentTypeSpreadsheet = 'contentType#Spreadsheet';
var constContentTypeDoc = 'contentType#Doc';
var constContentTypeMxGraph = 'contentType#MxGraph';

// variables for stop/resume
var isSopped = false;
var isSkipGetItem = false;
var isSkipContent = false;
var isSkipContentImage = false;
var isSkipContentVideo = false;
var isSkipImage = false;
var isSkipAttach = false;
// variables for attachments
var page_content = null;
var page_item = null;
var attachments = null;
var currentContentImage;
var currentContentVideo;
var currentImage;
var currentAttachmentIndex;
var currentAttachmentChunkIndex;
var currentAttachmentChunkTotal;


function init() 
{
	var isGoOn = true;

	if (db == null) {
		if (require('electron').remote != undefined) {
			isGoOn = false;
			console.log('completed initialize thread...');
	        db = require('electron').remote.getGlobal('sqliteDB');
	        setSQLiteDB(db);  
	        interval();      
	    }
    }

    if (isGoOn) {
    	setTimeout(init, 200);
    }
}

init();
//setInterval(interval, 500);
//interval();

function interval()
{
    var isStopped = require('electron').remote.getGlobal('isStopped');

    if (isStopped) {
        console.log('__ (status) stopped...');
        setTimeout(interval, 300);
    } else {
        console.log('__ (status) running...');    

	    if (stoppedPage) {
	        console.log('resume the stoppedPage...');
	        currentPage = stoppedPage;
	        stoppedPage = null;
	        downloadPage(currentPage);

	    } else if (currentPage == null) {

	        dbGetDownloadsListFromPages(function(arrPageList){
	            arrPage = arrPageList;

	            if (arrPageList.length > 0) {
	            	ipcRenderer.send( "selectDownload", true );
	            	currentPage = arrPageList[0];   
		            console.log('======currentPage', currentPage);   

		      		isSkipGetItem = false;
		            isSkipContent = false;
		            isSkipContentImage = false;
					isSkipContentVideo = false;
		            isSkipImage = false;
		            isSkipAttach = false;
		            downloadPage(currentPage);
	            } else {
	            	if (require('electron').remote.getGlobal('isSelectDown')) {
		                saveLog( 'completed', '', 1 );
		                var msg = {};
		                msg.msg = 'Complete to downloading items.';  
	        			msg.type = 'info';   
		                ipcRenderer.send( "showDialong", msg );
		                ipcRenderer.send( "selectDownload", false );
		                
		            }
		            setTimeout(interval, 1000);
	            } 
	        });
	    } else {
	    	//console.log('** waiting_currentPage = ', currentPage);
	    	//checkIsCompletedThenSet(currentPage);
	    }
    }
    // setTimeout(interval, 200);
}

function processErrors(jqXHR)
{
    var msg = {};

    if(jqXHR == null || jqXHR.status==0) { // internet connection broke  
        msg.msg = 'Ohh, Network connection has broken. Please Check it out.';  
        msg.type = 'error';      
        stoppedPage = currentPage;
        saveLog('Ooh, Internet connection has broken.', '', 0);
        ipcRenderer.send( "setDownloadStatus", true );
        ipcRenderer.send( "showDialong", msg );
    } else if(jqXHR.status==500) { // internal server error
        msg.msg = 'Ohh, Internal server error occurred. Please Check it out.';
        msg.type = 'error';      
        stoppedPage = currentPage;
        saveLog('Ooh, Internal Server error.', '', 0);
        ipcRenderer.send( "setDownloadStatus", true );
        ipcRenderer.send( "showDialong", msg );
    } else if(jqXHR.status==502) { // bad gateway
        msg.msg = 'Ohh, Server is Bad gatewy. Please Check it out.';
        msg.type = 'error';      
        stoppedPage = currentPage;
        saveLog('Ooh, Bad Gateway.', '', 0);
        ipcRenderer.send( "setDownloadStatus", true );
        ipcRenderer.send( "showDialong", msg );
    } else if(jqXHR.status==400) { // bad request...
        msg.msg = 'bad request';
        msg.type = 'error';      
        currentPage = null;
	    //interval();
    } else {
        msg.msg = 'unknow error';
        msg.type = 'error';      
    }
    if (jqXHR) {
    	console.log('jqXHR.status = ', jqXHR.status);
    }
    console.log(msg);
    interval();
}

function downloadPage(pageId) 
{
    console.log('start downloading page ...', pageId);
    //saveLog(pageId + ' start downloading...', true);

    dbQueryInfo(server_addr + '/memberAPI/preflight', {
        sessionResetRequired: false
    }, function(data, textStatus, jQxhr ){
        if(data.status === 'ok'){
            privateKeyPem = data.privateKey;
            getPageItem(pageId, data.expandedKey, data.privateKey, data.searchKey, function(err, item) {
                if (err) {
                    //alert(err);
                    console.info('!!!_err_getPageItem (pageId = )', pageId);
                    saveLog('  Ooh, Errors occured, but go on.');
                    dbUpdatePageStatusWithError(pageId);
                    currentPage = null;
                    interval();
                } else {
                    console.info('!!!_complete_getPageItem (pageId = )', pageId);                    

                    function waitForPageSettingTotalCounters(itemId)
                    {
                    	if (currentPage) {
                    		dbCheckPageTotalCounters(itemId, function(isReady) {
	                            if (isReady) {
	                                checkIsCompletedThenSet(pageId, function(isCompleted) {
	                                	if (isCompleted) {
	                                		currentPage = null;
	                                		interval();
	                                	} else {
	                                		setTimeout(waitForPageSettingTotalCounters, 200, itemId );
	                                	}
	                                	
	                                });
	                            } else {
	                                setTimeout(waitForPageSettingTotalCounters, 200, itemId );
	                            }
	                        })	
                    	}
                        
                    }
                    waitForPageSettingTotalCounters(pageId);
                    
                }
                //currentPage = null;
            });
        }
    });

}

function getPageItem(thisItemId, thisExpandedKey, thisPrivateKey, thisSearchKey, done, thisVersion) {
    oldVersion = "undefined"
    if (!thisVersion) {
        expandedKey = thisExpandedKey;
        privateKey = thisPrivateKey;
        searchKey = thisSearchKey;
        itemId = thisItemId;
    }
    
    function getPageComments() {
        var default_size = 100;
        var return_size = 0;
        var return_data = {};
        
        $.post(server_addr + '/memberAPI/getPageComments', {        
            itemId: thisItemId,
            size: default_size,
            from: 0
        }, function(data, textStatus, jQxhr) {
            if (data.status === "ok") {
                var total = data.hits.total;
                var hits = data.hits.hits;

                if (default_size < total) {
                    $.post(server_addr + '/memberAPI/getPageComments', {
                        itemId: thisItemId,
                        size: total,
                        from: 0
                    }, function(total_data, textStatus, jQxhr) {
                        dbInsertPageContents(server_addr + '/memberAPI/getPageComments', thisItemId, total_data);
                    });
                } else {
                    dbInsertPageContents(server_addr + '/memberAPI/getPageComments', thisItemId, data);
                }
                    
            } else {
                console.log('err_getPageComments', 'none');
            }
        })
        .fail(function(jqXHR, textStatus, errorThrown){
            processErrors(jqXHR);
        });
    } // end function
    
    var options = {
        itemId: thisItemId
    };
    if (thisVersion) {
        options.oldVersion = thisVersion;
    }

    if (isSkipGetItem) {
        startDownloadResourceFiles(page_content, page_item, function() {
            done();
        });
        return;
    }
    
    saveLog('< ' + thisItemId + '> started.', '', 1);

    $.post(server_addr + '/memberAPI/getPageItem', options, function(data, textStatus, jQxhr) {
        if (data.status === 'ok') {
            console.log('  == (downloaded page item)');
            dbInsertPageContents(server_addr + '/memberAPI/getPageItem', thisItemId, data);

            if (data.item) {
                itemCopy = data.item;
                isBlankPageItem = false;

                var item = data.item;

                itemSpace = item.space;
                itemContainer = item.container;
                itemPosition = item.position;

                dbInsertDownloadList(itemContainer);

                function decryptItem(envelopeKey, fn) {
                    if((item.keyEnvelope === undefined) || (item.envelopeIV === undefined) || (item.ivEnvelope === undefined) || (item.ivEnvelopeIV === undefined)) {
						//getAndShowPath(itemId, envelopeKey, teamName, "");
						//dbUpdatePageStatusWithError(itemId);
						done("Error: undefined item key");
						return;
					}
                    itemKey = decryptBinaryString(item.keyEnvelope, envelopeKey, item.envelopeIV);
                    itemIV = decryptBinaryString(item.ivEnvelope, envelopeKey, item.ivEnvelopeIV);
                    itemTags = [];
                    if (item.tags && item.tags.length > 1) {
                        var encryptedTags = item.tags;
                        for (var i = 0; i < (item.tags.length - 1); i++) {
                            try {
                                var encryptedTag = encryptedTags[i];
                                var encodedTag = decryptBinaryString(encryptedTag, itemKey, itemIV);
                                var tag = forge.util.decodeUtf8(encodedTag);
                                //itemTags.push(tag);
                                if (tag == constContentTypeWrite) {
                                    pageContentType = tag;
                                } else if (tag == constContentTypeDraw) {
                                    pageContentType = tag;
                                } else if (tag == constContentTypeSpreadsheet) {
                                    pageContentType = tag;
                                } else if (tag == constContentTypeDoc) {
                                    pageContentType = tag;
                                } else if (tag == constContentTypeMxGraph) {
                                    pageContentType = tag;
                                } else {
                                    itemTags.push(tag);
                                }
                            } catch (err) {
                                alert(err);
                            }
                        }
                        //$('#tagsInput').tokenfield('setTokens', itemTags);
                    } else {
                        pageContentType = constContentTypeWrite;
                    }

                    $('.container').data('itemId', itemId);
                    $('.container').data('itemKey', itemKey);
                    $('.container').data('itemIV', itemIV);
                    var titleText = "";
                    if (item.title) {
                        try {
                            var encodedTitle = decryptBinaryString(item.title, itemKey, itemIV);
                            title = forge.util.decodeUtf8(encodedTitle);
                            title = DOMPurify.sanitize(title);
                            $('.froala-editor#title').html(title);
                            titleText = document.title = $(title).text();
                        } catch (err) {
                            alert(err);
                        }
                    } else {
                        $('.froala-editor#title').html('<h2></h2>');
                    }
                    pageName = titleText;

                    saveLog('< ' + pageName + '> started.', '', 1);
                    //if (current_down_item) logObj.push(current_down_item);
                    current_down_item = { 'itemId': thisItemId, 'itemName': pageName, logs: [] };
                    current_down_item.logs.push();
                    //getAndShowPath(thisItemId, envelopeKey, teamName, titleText);
                    getAndShowPath(thisItemId, envelopeKey, titleText);
                    var item_content = '';
                    var content = null;
                    if (item.content) {
                        try {
                            var encodedContent = decryptBinaryString(item.content, itemKey, itemIV);
                            content = forge.util.decodeUtf8(encodedContent);
                            DOMPurify.addHook('afterSanitizeAttributes', function(node) {
                                // set all elements owning target to target=_blank
                                if ('target' in node) {
                                    node.setAttribute('target', '_blank');
                                }
                                // set non-HTML/MathML links to xlink:show=new
                                if (!node.hasAttribute('target') && (node.hasAttribute('xlink:href') || node.hasAttribute('href'))) {
                                    node.setAttribute('xlink:show', 'new');
                                }
                            });
                            content = DOMPurify.sanitize(content);
                            item_content = content;
                            //$('.froala-editor#content').html(content);
                            if (content && (pageContentType == null)) { // old case...
                                pageContentType = constContentTypeWrite;
                            }
                        } catch (err) {
                            alert(err);
                        }
                    } else {
                        dbSetTotalCountersOfPage(itemId, 'ContentsImage', 0);
                        dbSetTotalCountersOfPage(itemId, 'Video', 0);
                    }

                    // initContentView(content);

                    var image_length = 0;
                    if (item.images && item.images.length) {
                    	image_length = item.images.length;
                        // dbSetTotalCountersOfPage(itemId, 'Image', item.images.length);

                        function buildDownloadImagesList() {
                            var images = item.images;
                            var $lastElement = $('.imageBtnRow');
                            for (var i = 0; i < images.length; i++) {
                                $downloadImage = $('.downloadImageTemplate').clone().removeClass('downloadImageTemplate hidden').addClass('downloadImage');
                                var id = 'index-' + i;
                                $downloadImage.attr('id', id);
                                var s3Key = images[i].s3Key;
                                var words = images[i].words;
                                $downloadImage.data('s3Key', s3Key);
                                $downloadImage.data('words', words);
                                $downloadImage.find('.downloadText').text("");
                                $lastElement.after($downloadImage);
                                $lastElement = $downloadImage;
                            }
                        }

                        buildDownloadImagesList();
                    } else {
                        // dbSetTotalCountersOfPage(itemId, 'Image', 0);
                    }

                    page_content = content;
                    page_item = item;
                    isSkipGetItem = true;

                    currentContentImage = 0;
                    currentContentVideo = 0;
                    currentImage = 0;
                    currentAttachmentIndex = 1;
                    currentAttachmentChunkIndex = 0;

                    var content_image_length = 0;
                    var content_video_length = 0;

                    if ( (page_content) && (pageContentType == constContentTypeWrite) ){
                    	//console.log('page_content = ', page_content);
                    	var encryptedImages = $(page_content).find(".bSafesImage");
                    	var videoDownloads = $(page_content).find(".bSafesDownloadVideo");
                    	content_image_length = encryptedImages.length;
                    	content_video_length = videoDownloads.length;
                    }

                    // counts content image.                    
				    dbSetTotalCountersOfPage(itemId, 'ContentsImage', content_image_length);
				    console.log('  == (contents_image counts = )', content_image_length);
				    if (content_image_length) {
				    	saveLog('   Content Image counts : ' + content_image_length);
				    }

				    // counts content video.				    
				    dbSetTotalCountersOfPage(itemId, 'Video', content_video_length);
				    console.log('  == (contents_video counts = )', content_video_length);
    				if (content_video_length) {
				    	saveLog('   Content Video counts : ' + content_video_length);    					
    				}

    				// counts image.
    				dbSetTotalCountersOfPage(itemId, 'Image', image_length);
    				console.log('  == (Iamge counts = )', image_length);
    				if (image_length) {
				    	saveLog('   Image counts : ' + image_length);    					
    				}

    				// counts attachments.
                    attachments = item.attachments; 
                    var attachments_length = attachments.length - 1;                   

                    dbSetTotalCountersOfPage(itemId, 'Attatchment', attachments_length);
                    console.log('  == Attachment counts : ' + attachments_length);
                    if (attachments_length) {
                    	saveLog('   Attachment counts : ' + attachments_length); 
                    }

                    startDownloadResourceFiles(page_content, page_item, function() {
                        fn();
                    });
                    
                    
                } // end function decryptItem()

                if (itemSpace.substring(0, 1) === 'u') {
                    $('.navbarTeamName').text("Yours");
                    decryptItem(expandedKey, done);
                    getPageComments();
                    //done(null, item);
                } else {
                    isATeamItem = true;
                    var itemSpaceParts = itemSpace.split(':');
                    itemSpaceParts.splice(-2, 2);
                    teamId = itemSpaceParts.join(':');
                    getTeamData(teamId, function(err, team) {
                        if (err) {
                            done(err, item);
                        } else {
                            var teamKeyEnvelope = team.teamKeyEnvelope;
                            teamKey = pkiDecrypt(teamKeyEnvelope);
                            var encryptedTeamName = team.team._source.name;
                            var teamIV = team.team._source.IV;
                            teamName = decryptBinaryString(encryptedTeamName, teamKey, teamIV);
                            teamName = forge.util.decodeUtf8(teamName);
                            teamName = DOMPurify.sanitize(teamName);

                            if (teamName.length > 20) {
                                var displayTeamName = teamName.substr(0, 20);
                            } else {
                                var displayTeamName = teamName;
                            }

                            $('.navbarTeamName').text(displayTeamName);

                            var teamSearchKeyEnvelope = team.team._source.searchKeyEnvelope;
                            var teamSearchKeyIV = team.team._source.searchKeyIV;

                            teamSearchKey = decryptBinaryString(teamSearchKeyEnvelope, teamKey, teamSearchKeyIV);
                            //setIsATeamItem(teamKey, teamSearchKey);

                            decryptItem(teamKey, done);
                            getPageComments();
                            //done(null, item);
                        }
                    });
                }
            } else {

                if ((itemId.substring(0, 2) === 'np') || (itemId.substring(0, 2) === 'dp')) {
                    itemIdParts = itemId.split(':');

                    if (itemId.substring(0, 2) === 'np') {
                        itemContainer = 'n';
                        itemPosition = Number(itemIdParts[itemIdParts.length - 1]);
                    } else if (itemId.substring(0, 2) === 'dp') {
                        itemContainer = 'd';
                        var dateText = itemIdParts[itemIdParts.length - 1];
                        dateText = dateText.replace(/-/g, "");
                        itemPosition = Number(dateText);
                    }
                    for (var i = 1; i < itemIdParts.length - 1; i++) {
                        itemContainer = itemContainer + ':' + itemIdParts[i];
                    }
                    //setupContainerPageKeyValue('itemPosition', itemPosition);
                    isBlankPageItem = true;
                    getPath(itemContainer, itemId, function(itemPath) {
                        itemSpace = itemPath[0]._id;

                        if (itemSpace.substring(0, 1) === 't') {
                            isATeamItem = true;

                            var itemSpaceParts = itemSpace.split(':');
                            itemSpaceParts.splice(-2, 2);
                            teamId = itemSpaceParts.join(':');
                            getTeamData(teamId, function(err, team) {
                                if (err) {
                                    done(err, thisItemId);
                                } else {
                                    var teamKeyEnvelope = team.teamKeyEnvelope;
                                    teamKey = pkiDecrypt(teamKeyEnvelope);
                                    var encryptedTeamName = team.team._source.name;
                                    var teamIV = team.team._source.IV;
                                    teamName = decryptBinaryString(encryptedTeamName, teamKey, teamIV);
                                    teamName = forge.util.decodeUtf8(teamName);
                                    teamName = DOMPurify.sanitize(teamName);
                                    var teamSearchKeyEnvelope = team.team._source.searchKeyEnvelope;
                                    var teamSearchKeyIV = team.team._source.searchKeyIV;
                                    teamSearchKey = decryptBinaryString(teamSearchKeyEnvelope, teamKey, teamSearchKeyIV);
                                    $('.pathSpace').find('a').html(teamName);
                                    //showPath(teamName, itemPath, itemContainer, teamKey, itemId);

                                    //setupNewItemKey();
                                    console.log('err1');
                                    done(null, null);
                                }
                            });
                        } else {
                            //setupNewItemKey();
                            //showPath('Personal', itemPath, itemContainer, expandedKey, itemId);
                            console.log('err2');
                            done(null, null);
                        }
                    });
                } else {
                    console.log('err3');
                    done(null, null);
                }
            }
        } else {
            console.log('** (err_getPageItem_data.status)', data.error, thisItemId);
            done(data.error, null)
        }
        
    }, 'json')
    .fail(function(jqXHR, textStatus, errorThrown){
        console.log('** (err_getPageItem_post)', thisItemId);
        processErrors(jqXHR);
    });
}


function getTeamData(teamId, done) {
    $.post(server_addr + '/memberAPI/getTeamData', {
        teamId: teamId
    }, function(data, textStatus, jQxhr) {
        if(data.status === 'ok') {
            dbInsertTeams(server_addr + '/memberAPI/getTeamData', teamId, data);
            dbInsertDownloadList(teamId);
            done(null, data.team);              
        } else {
            console.log('err4_getTeamData');
            done(data.error, null);
              console.log('err:(getTeamData)', data.error);
        }
    }, 'json')
    .fail(function(jqXHR, textStatus, errorThrown){
        processErrors(jqXHR);
    });
};    

var pkiDecrypt = function(encryptedData) {
    var privateKeyFromPem = pki.privateKeyFromPem(privateKeyPem);
    var decryptedData = privateKeyFromPem.decrypt(encryptedData);
    var decodedData = forge.util.decodeUtf8(decryptedData);
    return decodedData;
}

function getPath(itemId, pageId, done) {
    $.post(server_addr + '/memberAPI/getItemPath', {
        itemId: itemId
    }, function(data, textStatus, jQxhr) {
        if(data.status === 'ok') {
            var path = data.itemPath;
            dbInsertItemPath(server_addr + '/memberAPI/getItemPath', itemId, data);
            done(path);
        } else {
            console.log('err5');
        }
    })
    .fail(function(jqXHR, textStatus, errorThrown){
        processErrors(jqXHR);
    });
};

//function getAndShowPath(itemId, envelopeKey, teamName, endItemTitle) {
function getAndShowPath(itemId, envelopeKey, endItemTitle) {
    $.post(server_addr + '/memberAPI/getItemPath', {
        itemId: itemId 
    }, function(data, textStatus, jQxhr) {
        if(data.status === 'ok') {
            dbInsertItemPath(server_addr + '/memberAPI/getItemPath', itemId, data);
            //showPath(teamName, data.itemPath, itemId, envelopeKey, null ,endItemTitle);
        } else {
            console.log('err6');
        }
    }, 'json')
    .fail(function(jqXHR, textStatus, errorThrown){
        processErrors(jqXHR);
    });
}

function isImageDisplayed(imageElement) {
    var src = imageElement.attr('src');
    return src.indexOf('blob:') === 0;
}

// for page resource!!!!

function downloadContentImageObjects(item_content, itemId, done) {

	if (isSkipContentImage) {
		done();
	} else {
		var encryptedImages = $(item_content).find(".bSafesImage");

	    if (encryptedImages.length) {
	        downloadImageObject(item_content, itemId, currentContentImage, function () {
	            done();
	        });
	    } else {
	        done();
	    }
	}

    
}

function downloadImageObject(item_content, itemId, index, done) {

    var encryptedImages = $(item_content).find(".bSafesImage");
    
    if (index < encryptedImages.length) {

        var encryptedImageElement = $(encryptedImages[index]);

        currentDownloadingImageElement = encryptedImageElement;
        currentDownloadingImageElement.addClass('bSafesDownloading');

        var id = currentDownloadingImageElement.attr('id');

        var s3CommonKey = id.split('&')[0];
        var s3Key = s3CommonKey + '_gallery';

        $.post(server_addr + '/memberAPI/preS3Download', {
            itemId: itemId,
            s3Key: s3Key
        }, function(data, textStatus, jQxhr) {
            if (data.status === 'ok') {
                var signedURL = data.signedURL;
                var isDownloaded = false;

                var xhr = new XMLHttpRequest();
                xhr.open('GET', signedURL, true);
                xhr.responseType = 'arraybuffer';

                xhr.addEventListener("progress", function(evt) {
                    if (evt.lengthComputable) {
                        var percentComplete = evt.loaded / evt.total * 100;
                        $(document.getElementById('progressBar' + id)).width(percentComplete + '%');
                        console.log('  == (contents_image)', index + 1, s3Key, percentComplete);
                    }
                }, false);

                xhr.onload = function(e) {
                    var buffer = this.response;
                    var file_name = uuidv1();
                    isDownloaded = true;

                    fs.open(download_folder_path + file_name, 'w', function(err, fd) {
                        if (err) {
                            throw 'could not open file: ' + err;
                        }
                        // write the contents of the buffer, from position 0 to the end, to the file descriptor returned in opening our file
                        fs.write(fd, new Buffer(buffer), 0, buffer.length, null, (err) => {
                            if (err) throw 'error writing file: ' + err;
                            dbInsertPageContentsFiles(server_addr + '/memberAPI/preS3Download', itemId, s3Key, file_name);
                            //updatePageStatus(itemId, 'ContentsImage');
                            fs.close(fd, function() {
                                //console.log('wrote the ContentsImage file successfully');
                                saveLog('  Content Image ' + (index + 1).toString() + ' downloaded');
                                index = index + 1;
                                currentContentImage = index;
                                updatePageStatus(itemId, 'ContentsImage', function() {
                                	downloadImageObject(item_content, itemId, index, done);
                                });

                            });
                        });
                    });

                   
                }
                ;
                xhr.onerror = function (e) {
                    dbUpdatePageStatusWithError(itemId);
                    //alert('Ooh, please retry! Error occurred when connecing the url : ', signedURL);
                    //console.log('Ooh, please retry! Error occurred when connecing the url : ', signedURL);
                    console.log('** (err_preS3Download_contentsimg)', signedURL);
                    saveLog('  Ooh, Errors occured');
                    if (isDownloaded) processErrors(null);
                };

                xhr.send();

            }
        }, 'json')
        .fail(function(jqXHR, textStatus, errorThrown){
            console.log('** (err_preS3Download_contentsimg_ajax)', signedURL);
            processErrors(jqXHR);
        });
        
    } else {
        done();
    }   
}

function downloadVideoObject(item_content, itemId, index, done) {

    var videoDownloads = $(item_content).find(".bSafesDownloadVideo");

    if (currentContentVideo < videoDownloads.length) {

        $videoDownload = $(videoDownloads[currentContentVideo]);

        $videoDownload.off('click');
        $videoDownload.addClass('bSafesDownloading');
        var id = $videoDownload.attr('id');
        var s3Key = $videoDownload.attr('id').split('&')[0];

        $.post(server_addr + '/memberAPI/preS3Download', {
            itemId: itemId,
            s3Key: s3Key
        }, function(data, textStatus, jQxhr) {
            if (data.status === 'ok') {
                dbInsertPageVideo(server_addr + '/memberAPI/preS3Download', itemId, s3Key, data);
                var signedURL = data.signedURL;

                var xhr = new XMLHttpRequest();
                xhr.open('GET', signedURL, true);
                xhr.responseType = 'arraybuffer';

                xhr.addEventListener("progress", function(evt) {
                    if (evt.lengthComputable) {
                        var percentComplete = evt.loaded / evt.total * 100;

                        console.log('  == (video)', currentContentVideo + 1, s3Key, percentComplete);
                        saveLog('  Video ' + (currentContentVideo + 1).toString() + ' downloading : ' + percentComplete + '%', s3Key);
                        $(document.getElementById('progressBar' + id)).width(percentComplete + '%');
                    }
                }, false);

                xhr.onload = function(e) {
                    var buffer = this.response;
                    var file_name = uuidv1();
                    fs.open(download_folder_path + file_name, 'w', function(err, fd) {
                        if (err) {
                            throw 'could not open file: ' + err;
                        }
                        // write the contents of the buffer, from position 0 to the end, to the file descriptor returned in opening our file
                        fs.write(fd, new Buffer(buffer), 0, buffer.length, null, (err) => {
                            if (err) throw 'error writing file: ' + err;
                            //dbInsertPageAttatchment(server_addr + '/memberAPI/preS3ChunkDownload', itemId, current_chunkIndex, id, data='', file_name);
                            dbInsertPageVideo(server_addr + '/memberAPI/preS3Download', itemId, s3Key, data='', file_name);
                            // updatePageStatus(itemId, 'Video');
                            fs.close(fd, function() {
                                saveLog('  Content Video ' + (currentContentVideo + 1).toString() + ' downloaded');
                                //index = index + 1;
                                //currentContentVideo = index;
                                updatePageStatus(itemId, 'Video', done);
                                //done();
                                //console.log('wrote the Video file successfully');
                            });
                        });
                    });
                }
                ;

                xhr.onerror = function (e) {
                    dbUpdatePageStatusWithError(itemId);
                    //alert('Ooh, please retry! Error occurred when connecing the url : ', signedURL);
                    //console.log('Ooh, please retry! Error occurred when connecing the url : ', signedURL);
                    console.log('** (err_preS3Download_video)', signedURL);
                    saveLog('  Ooh, Errors occured');
                    done();
                    //if (isDownloaded) processErrors(null);
                };

                xhr.send();

            } else {
                console.log('err6');
            }
        }, 'json')
        .fail(function(jqXHR, textStatus, errorThrown){
            console.log('** (err_preS3Download_video_ajax)');
            processErrors(jqXHR);
        });
    }
}
;
function handleVideoObjects(item_content, itemId, done) {

	if (isSkipContentVideo) {
		done();
	} else {
		var videoDownloads = $(item_content).find(".bSafesDownloadVideo");

	    if (currentContentVideo < videoDownloads.length) {
	 
	        var doneDownloadingAnVideo = function(err) {
	            if (err) {
	                console.log(err);
	                done(err);
	            } else {
	                currentContentVideo = currentContentVideo + 1;
	                //currentAttachmentChunkIndex = 0;
	                if (currentContentVideo < videoDownloads.length) {
	                    //attachment = attachments[currentAttachmentIndex];
	                    downloadVideoObject(item_content, itemId, currentContentVideo, doneDownloadingAnVideo);
	                } else {
	                    done(null);
	                }
	            }
	        };
	        downloadVideoObject(item_content, itemId, currentContentVideo, doneDownloadingAnVideo);
	    } else {
	        done(null);
	    }
	}
}

function startDownloadingImages(item, done) {
    var $downloadImagesList = $('.downloadImage');
    var index = currentImage;

    function downloadAnImage(done) {
        $downloadImage = $($downloadImagesList[index]);
        $downloadImage.find('.downloadText').text("Downloading");
        var id = $downloadImage.attr('id');
        // var s3CommonKey = $downloadImage.data('s3Key');
        // var s3Key = s3CommonKey + "_gallery";
        var images = item.images;
        var s3CommonKey = images[index].s3Key;
        var s3Key = s3CommonKey + "_gallery";

        $.post(server_addr + '/memberAPI/preS3Download', {
            itemId: itemId,
            s3Key: s3Key
        }, function(data, textStatus, jQxhr) {
            if (data.status === 'ok') {
                dbInsertPageIamge(server_addr + '/memberAPI/preS3Download', itemId, s3Key, data);
                var signedURL = data.signedURL;

                var xhr = new XMLHttpRequest();
                xhr.open('GET', signedURL, true);
                xhr.responseType = 'arraybuffer';

                xhr.addEventListener("progress", function(evt) {
                    if (evt.lengthComputable) {
                        var percentComplete = evt.loaded / evt.total * 100;
                        $downloadImage.find('.progress-bar').css('width', percentComplete + '%');
                        saveLog('  Image ' + (index + 1).toString() + ' downloading : ' + percentComplete + '%', s3Key);
                        console.log('  == (image)', index + 1, s3Key, percentComplete);
                        //console.log('****edi_image download' + s3Key + ':' + percentComplete);
                    }
                }, false);

                xhr.onload = function(e) {
                    $downloadImage.find('.downloadText').text("Decrypting");
                    //currentImageDownloadXhr = null;
                    var encryptedImageDataInArrayBuffer = this.response;
                    var buffer = this.response;
                    var file_name = uuidv1();
                    fs.open(download_folder_path + file_name, 'w', function(err, fd) {
                        if (err) {
                            throw 'could not open file: ' + err;
                        }
                        // write the contents of the buffer, from position 0 to the end, to the file descriptor returned in opening our file
                        fs.write(fd, new Buffer(buffer), 0, buffer.length, null, (err) => {
                            if (err) throw 'error writing file: ' + err;
                            dbInsertPageIamge(server_addr + '/memberAPI/preS3Download', itemId, s3Key, data = '', file_name);
                            // updatePageStatus(itemId, 'Image');
                            fs.close(fd, function() {
                                //console.log('wrote the Image file successfully');
                                updatePageStatus(itemId, 'Image', done);
                                // done(null);
                            });
                        });
                    });

                }

                xhr.onerror = function(e) {
                    dbUpdatePageStatusWithError(itemId);
                    console.log('** (err_preS3Download)', signedURL);
                    saveLog('  Ooh, Errors occured');
                    processErrors(null);
                };

                xhr.send();

            }
        }, 'json')
        .fail(function(jqXHR, textStatus, errorThrown){
            processErrors(jqXHR);
        });

    }

    var doneDownloadingAnImage = function(err) {
        if (err) {
            console.log(err);
            done(err);
        } else {
            index++;
            currentImage = index;
            //if (index < $downloadImagesList.length) {
            if (index < item.images.length) {
                downloadAnImage(doneDownloadingAnImage);
            } else {
                done(null);
            }
        }
    };

    if (isSkipImage) {
        done();
    } else if (item.images && item.images.length) {
        downloadAnImage(doneDownloadingAnImage);
    } else {
        //console.log('  == (image counts = )', 0);
        done();
    }
    
}

function downloadAllAttachment(done)
{
    //currentAttachmentIndex = 1;
                    
    if (currentAttachmentIndex < attachments.length) {
        

        var attachment = attachments[currentAttachmentIndex];
        // currentAttachmentChunkIndex = 0;

        var doneDownloadingAnAttach = function(err) {
            if (err) {
                console.log(err);
                done(err);
            } else {
                currentAttachmentIndex = currentAttachmentIndex + 1;
                currentAttachmentChunkIndex = 0;
                if (currentAttachmentIndex < attachments.length) {
                    attachment = attachments[currentAttachmentIndex];
                    downloadAttachment(attachment.s3KeyPrefix, doneDownloadingAnAttach);
                } else {
                    done(null);
                }
            }
        };

        downloadAttachment(attachment.s3KeyPrefix, doneDownloadingAnAttach);
    } else {
        done(null);
    }
}

var downloadAttachment = function(id, done) {
    
    var fileName;
    var fileType;
    var fileSize;
    var numberOfChunks;
    //var chunkIndex = 0;
    var decryptChunkIndex = 0;
    var decryptedFileInUint8Array;
    var decryptedFileIndex;
    var $decryptChunkDeferred = $.Deferred();
    var $decryptChunkPromise = $decryptChunkDeferred.promise();
    $decryptChunkDeferred.resolve();
    //console.log('Download ', id);

    var downloadedFileProgress = 0;

    //currentAttachmentChunkIndex = 0;
    console.log('currentAttachmentIndex = ', currentAttachmentIndex);
    console.log('currentAttachmentChunkIndex = ', currentAttachmentChunkIndex);

    function downloadDecryptAndAssemble() {

        function enableResume() {
            //changeDownloadingState($attachment, 'Stopped');
            var $resume = $attachment.find('.resumeBtn');
            $resume.off();
            $resume.click(function(e) {
                console.log('resuming downloading chunk:', chunkIndex);
                //changeDownloadingState($attachment, 'Downloading');
                downloadDecryptAndAssemble();
            });
        }

        function downloadAChunk(signedURL) {
            var xhr = new XMLHttpRequest();
            var isDownloaded = false;
            
            xhr.open('GET', signedURL, true);
            xhr.responseType = 'arraybuffer';
            //console.log('signedURL = ', signedURL);

            var attachmentFileProgress = 0;
            var previousProgress = 0;
            var timer;

            var timeout = function() {
                if (xhr) {
                    if (attachmentFileProgress === previousProgress) {
                        xhr.abort();
                    } else {
                        previousProgress = attachmentFileProgress;
                        timer = setTimeout(timeout, 10000);
                    }
                }
            };
            timer = setTimeout(timeout, 10000);

            xhr.addEventListener("progress", function(evt) {
                //console.log('isDownloaded:', isDownloaded);
                if (isDownloaded)
                    return;
                if (evt.lengthComputable) {
                    attachmentFileProgress = downloadedFileProgress + (evt.loaded / evt.total * 100) / numberOfChunks;
                    attachmentFileProgress = Math.floor(attachmentFileProgress * 100) / 100;
                    if (attachmentFileProgress == 'NaN') {
                        console.log('err_attachmentFileProgress');
                    }
                    //console.log('current / total = ', currentAttachmentChunkIndex + ' / ' + numberOfChunks);
                    console.log('  == (attachment, AttachIndex, chunkIndex, prog)', currentAttachmentIndex + 0, currentAttachmentChunkIndex, attachmentFileProgress);
                    saveLog('  Attachment ' + (currentAttachmentIndex + 0).toString() + ' downloading : ' + attachmentFileProgress + '%', id);
                }
            }, false);

            xhr.onload = function(e) {
                var buffer = this.response;
                var file_name = uuidv1();
                var current_chunkIndex = currentAttachmentChunkIndex;
                //var fn = done;
                fs.open(download_folder_path + file_name, 'w', function(err, fd) {
                    if (err) {
                        throw 'could not open file: ' + err;
                    }
                    // write the contents of the buffer, from position 0 to the end, to the file descriptor returned in opening our file
                    fs.write(fd, new Buffer(buffer), 0, buffer.length, null, (err) => {
                        if (err) throw 'error writing file: ' + err;
                        //console.log('dbInsertPageAttatchment(chunkIndex)', currentAttachmentChunkIndex)
                        
                        fs.close(fd, function() {
                            console.log('  wrote the Attatchment file successfully');
                            
                            
                        });
                    });
                });

                var encryptedChunkInArrayBuffer = this.response;
                isDownloaded = true;

                currentAttachmentChunkIndex++;
                if (currentAttachmentChunkIndex < numberOfChunks) {
                    downloadedFileProgress = currentAttachmentChunkIndex / numberOfChunks * 100;
                    downloadDecryptAndAssemble();
                } else {
                    dbInsertPageAttatchment(server_addr + '/memberAPI/preS3ChunkDownload', itemId, current_chunkIndex, id, data='', file_name);
                    updatePageStatus(itemId, 'Attatchment', done);
                    // done();
                }
                        
            }
            ;

            xhr.onerror = xhr.onabort = function() {
                //console.log('isDownloaded:', isDownloaded);
                if (isDownloaded)
                    return;
                //enableResume();
                processErrors(null);
            }

            xhr.onloadend = function() {
                if(xhr.status == 404) 
                    console.log(' **err_replied 404', signedURL     );
            }

            xhr.send();
        }

        $.post(server_addr + '/memberAPI/preS3ChunkDownload', {
            itemId: itemId,
            chunkIndex: currentAttachmentChunkIndex.toString(),
            s3KeyPrefix: id
        }, function(data, textStatus, jQxhr) {
            if (data.status === 'ok') {
                dbInsertPageAttatchment(server_addr + '/memberAPI/preS3ChunkDownload', itemId, currentAttachmentChunkIndex, id, data);
                //console.log(data);
                if (currentAttachmentChunkIndex === 0) {
                    //var encodedFileName = decryptBinaryString(data.fileName, itemKey, itemIV);
                    //fileName = forge.util.decodeUtf8(encodedFileName);
                    fileType = data.fileType;
                    fileSize = data.fileSize;
                    numberOfChunks = parseInt(data.numberOfChunks);
                    currentAttachmentChunkTotal = numberOfChunks;
                    //console.log('numberOfChunks', numberOfChunks);
                    decryptedFileInUint8Array = new Uint8Array(fileSize);
                    decryptedFileIndex = 0;
                } else {
                    numberOfChunks = currentAttachmentChunkTotal;
                    downloadedFileProgress = currentAttachmentChunkIndex / numberOfChunks * 100;
                }
                downloadAChunk(data.signedURL);
            } else {
                console.log('err6');
            }
        }, 'json')
        .fail(function(jqXHR, textStatus, errorThrown){
            processErrors(jqXHR);
        });
        ;
    }

    downloadDecryptAndAssemble();

    return false;
}

function startDownloadResourceFiles(content, item, fn)
{
    // first content images and videos
    initContentView(content, function() {
        isSkipContent = true;
        // download image
        startDownloadingImages(item, function() {
            isSkipImage = true;
            // download attachment
            downloadAllAttachment(function() {
                isSkipAttach = true;
                fn();
            });
        });
    });
}

function updatePageStatus(pageId, field, done)
{
    dbIncreaseDownloadedCountersOfPage(pageId, field, function(){  
    	done();
    });
}


function checkIsCompletedThenSet(pageId, done)
{
    dbUpdatePageStatus(pageId, function(err, isCompleted, row) {
    	var isFinished;
        if ( (!err) && (isCompleted) ){
            console.log('< ' + pageName + ' > finished.');            
            saveLog('< ' + pageName + ' > finished.', '', 1);     
            saveLog('< ' + pageId + ' > finished.', '', 1);      
            currentPage = null;           
            isFinished = true;
        } else {
        	isFinished = false;
        	console.log('< ' + pageName + ' >  something is wrong.'); 
        	console.log('row = ', row);
        	//setTimeout(checkIsCompletedThenSet, 200);
        }
        done(isFinished);
    });
}

function saveLog(message, skey='', node=2, isDevMsg=false)
{
    var logMesage;
    var isDev;

    if ((lastMsg == message)) {
        return;
    }

    if (require('electron').remote != undefined) {
        isDev = require('electron').remote.getGlobal('isDev');
        //if ( (isDev) || (!isDevMsg) ) 
        {
            var letter = {};
            letter.logTime = moment().format('YYYY-MM-DD hh:mm');
            letter.message = message;
            letter.skey = skey;
            letter.node = node;
            ipcRenderer.send( "sendDownloadMessage", letter );
            lastMsg = message;
        }
        //console.log('logMesage', require('electron').remote.getGlobal('logMesage'));
    } 
}

function initContentView(contentFromeServer, done)
{
    var pageLocalStorageContent = null;

    var content = null;
    $downloadContent = null;

    //console.log('starting_initContentView');

    // check localstorage content
    function getKeyContentFromLocalStorage() {
        if (localStorage.getItem(itemId + constContentTypeWrite)) {
            pageLocalStorageKey = itemId + constContentTypeWrite;
        } else if (localStorage.getItem(itemId + constContentTypeDraw)) {
            pageLocalStorageKey = itemId + constContentTypeDraw;
        } else if (localStorage.getItem(itemId + constContentTypeSpreadsheet)) {
            pageLocalStorageKey = itemId + constContentTypeSpreadsheet;
        } else if (localStorage.getItem(itemId + constContentTypeDoc)) {
            pageLocalStorageKey = itemId + constContentTypeDoc;
        } else if (localStorage.getItem(itemId + constContentTypeMxGraph)) {
            pageLocalStorageKey = itemId + constContentTypeMxGraph;
        } 

        if (pageLocalStorageKey != null) {
            // found LocalStorage item...
            pageLocalStorageContent = localStorage.getItem(pageLocalStorageKey);
            //console.log('pageLocalStorageContent = ', pageLocalStorageContent);
        }
    }

    // next get contents     
    if (isSkipContent) {
        done();
    } else if ( (pageContentType == null) && (pageLocalStorageContent == null) )  {
        done();
    } else {
        startGettingContent(function(err) {    
            //console.log('finish_startGettingContent');

            if (err) {
                console.log(err);
                alert(err);
            } else {                    
                var content_data = content;
                var isLocalStorage ;
                done();
            }
        });
    }

    function startGettingContent(doneGetting) {

        function getWriteTypesContent(done) {
            content = contentFromeServer;
            contentsFromServer = contentFromeServer;          

            downloadContentImageObjects(contentFromeServer, itemId, function() {
            	isSkipContentImage = true;
                handleVideoObjects(contentFromeServer, itemId, function() {
                	isSkipContentVideo = true;
                    done(null);
                });    
            });
            
            
        }

        function downloadOtherTypesContent(done) {
            var s3Key = contentFromeServer;
            //console.log('download_s3Key = ', s3Key);

            if (s3Key == null) {
                done(null); // this is version 1...
                return;
            }

            $.post(server_addr + '/memberAPI/preS3Download', {
                itemId: itemId,
                s3Key: s3Key
            }, function(data, textStatus, jQxhr) {
                //console.log('call_preS3Download = ', data.status);
                console.log('  == (downloaded other type s3Key)');
                saveLog('  downloaded type contents as s3object');

                if (data.status === 'ok') {
                    var signedURL = data.signedURL;
                    //console.log('signedURL = ', signedURL);

                    var xhr = new XMLHttpRequest();
                    xhr.open('GET', signedURL, true);
                    xhr.responseType = 'arraybuffer';

                    xhr.onload = function(e) {
                        var buffer = this.response;
                        var file_name = uuidv1();
                        fs.open(download_folder_path + file_name, 'w', function(err, fd) {
                            if (err) {
                                throw 'could not open file: ' + err;
                            }
                            // write the contents of the buffer, from position 0 to the end, to the file descriptor returned in opening our file
                            fs.write(fd, new Buffer(buffer), 0, buffer.length, null, (err) => {
                                if (err) throw 'error writing file: ' + err;
                                dbInsertPageOtherTypesContentFiles(server_addr + '/memberAPI/preS3Download', itemId, s3Key, file_name);
                                updatePageStatus(itemId, 'OtherTypesContent', done);
                                //done();
                                fs.close(fd, function() {
                                    //console.log('wrote the ContentsImage file successfully');
                                });
                            });
                        });

                        

                    };

                    xhr.onerror = function (e) {
                        dbUpdatePageStatusWithError(itemId);
                        //alert('Ooh, please retry! Error occurred when connecing the url : ', signedURL);
                        console.log('Ooh, please retry! Error occurred when connecing the url : ', signedURL);
                        saveLog('  Ooh, Error occured');
                        done();
                    };

                    xhr.onreadystatechange = function() {
                        if (xhr.status == 400) { // bad request
                            console.log('Ooh, bad data! It is bad URL request : \n', signedURL);
                            dbUpdatePageStatusWithError(itemId);
                            //processErrors(xhr);
                            xhr.abort();
                            done();
                        } else if (xhr.status != 200) { 
                            console.log('Ooh, bad data! It occurred when requesting : \n', xhr.status, signedURL);
                        }
                    };

                    xhr.send();
                    //currentImageDownloadXhr = xhr;

                } else {
                    dbUpdatePageStatusWithError(itemId);
                    done();
                }
            }, 'json')
            .fail(function(jqXHR, textStatus, errorThrown){
                processErrors(jqXHR);
            });

        };
        
        if ( (contentFromeServer == null) || (pageContentType == null) ){
            dbSetTotalCountersOfPage(itemId, 'OtherTypesContent', 0);
            doneGetting(null);
        } else if (pageContentType == constContentTypeWrite) {
            dbSetTotalCountersOfPage(itemId, 'OtherTypesContent', 0);
            getWriteTypesContent(doneGetting);
        } else {
            dbSetTotalCountersOfPage(itemId, 'ContentsImage', 0);
            dbSetTotalCountersOfPage(itemId, 'Video', 0);
            dbSetTotalCountersOfPage(itemId, 'OtherTypesContent', 1);
            downloadOtherTypesContent(doneGetting);
        }
    }

              
}
