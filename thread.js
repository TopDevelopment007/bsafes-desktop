var server_addr = 'https://www.openbsafes.com'
var download_folder_path = 'bsafes_downloads/';
var forge = require('node-forge');
var BSON = require('bson');
var pki = forge.pki;
var rsa = forge.pki.rsa;
var privateKeyPem;
var arrPage = [];
var currentPage = null;
const fs = require('fs');
const uuidv1 = require('uuid/v1');

var db = null;


setInterval(interval, 5000);

function interval()
{
	//console.log('timer');
	if (db == null) {
		if (require('electron').remote != undefined) {
			db = require('electron').remote.getGlobal('sqliteDB');
			setSQLiteDB(db);
		} else {
			return;
		}		
	}
    console.log('_______arrPage', arrPage.length);

    if (currentPage == null)
    {
        dbGetDownloadsListFromPages(function(arrPageList){
            arrPage = arrPageList;
            if (arrPageList.length == 0) {
                return;                
            }

            currentPage = arrPageList[0];   
            console.log('currentPage', currentPage);         
            dbupdatePageStatus(currentPage, function(isCompleted) {
                if (isCompleted) {
                    currentPage = null;
                    return;
                } else {
                    if (currentPage) {
                        downloadPage(currentPage);    
                    }                    
                }
            });

        });
    } 
}

function downloadPage(pageId) 
{
	console.log('start downloading...', pageId);
    dbQueryInfo(server_addr + '/memberAPI/preflight', {
		sessionResetRequired: false
	}, function(data, textStatus, jQxhr ){
		if(data.status === 'ok'){
			privateKeyPem = data.privateKey;
			getPageItem(pageId, data.expandedKey, data.privateKey, data.searchKey, function(err, item) {
                if (err) {
                    alert(err);
                } else {
                    console.info('!!!_complete (pageId = )', pageId);
                }
                currentPage = null;
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
        });
    }
    
    var options = {
        itemId: thisItemId
    };
    if (thisVersion) {
        options.oldVersion = thisVersion;
    }
    $.post(server_addr + '/memberAPI/getPageItem', options, function(data, textStatus, jQxhr) {
        if (data.status === 'ok') {
        	dbInsertPageContents(server_addr + '/memberAPI/getPageItem', thisItemId, data);

            if (data.item) {
                //postGetItemData(data.item);
                itemCopy = data.item;
                // if (!thisVersion) {
                //     setCurrentVersion(itemCopy.version);
                // } else {
                //     setOldVersion(thisVersion);
                // }
                isBlankPageItem = false;
                $('#nextPageBtn, #previousPageBtn').removeClass('hidden');
                console.log('data.item', data.item);

                var item = data.item;

                itemSpace = item.space;
                itemContainer = item.container;
                itemPosition = item.position;

                dbInsertDownloadList(itemContainer);

                function decryptItem(envelopeKey) {
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
                                itemTags.push(tag);
                            } catch (err) {
                                alert(err);
                            }
                        }
                        $('#tagsInput').tokenfield('setTokens', itemTags);
                    }
                    ;
                    // if (!thisVersion) {
                    //     initializeTagsInput();
                    // } else {
                    //     disableTagsInput();
                    // }

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

                    //getAndShowPath(thisItemId, envelopeKey, teamName, titleText);
                    getAndShowPath(thisItemId, envelopeKey, titleText);
                    var item_content = '';
                    if (item.content) {
                        try {
                            var encodedContent = decryptBinaryString(item.content, itemKey, itemIV);
                            var content = forge.util.decodeUtf8(encodedContent);
                            DOMPurify.addHook('afterSanitizeAttributes', function(node) {
                                // set all elements owning target to target=_blank
                                if ('target'in node) {
                                    node.setAttribute('target', '_blank');
                                }
                                // set non-HTML/MathML links to xlink:show=new
                                if (!node.hasAttribute('target') && (node.hasAttribute('xlink:href') || node.hasAttribute('href'))) {
                                    node.setAttribute('xlink:show', 'new');
                                }
                            });
                            content = DOMPurify.sanitize(content);
                            item_content = content;
                            $('.froala-editor#content').html(content);
                        } catch (err) {
                            alert(err);
                        }
                        downloadContentImageObjects(item_content, thisItemId);
                        handleVideoObjects(item_content, thisItemId);
                    }

                    if (item.images && item.images.length) {
                        dbSetTotalCountersOfPage(itemId, 'Image', item.images.length);
                    } else {
                        dbSetTotalCountersOfPage(itemId, 'Image', 0);
                    }

                    if (item.images && item.images.length) {
                        function downloadAndDisplayImages() {
                            //$('.imageBtnRow').addClass('hidden');

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
                            
                            function startDownloadingImages(done) {
                                var $downloadImagesList = $('.downloadImage');
                                var index = 0;

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
												        dbInsertPageIamge(server_addr + '/memberAPI/preS3Download', itemId, s3Key, data='', file_name);
                                                        updatePageStatus(itemId, 'Image');
												        fs.close(fd, function() {
												            console.log('wrote the Image file successfully');
												        });
												    });
												});

                                                $.post(server_addr + '/memberAPI/postS3Download', {
                                                    itemId: itemId,
                                                    s3Key: s3CommonKey
                                                }, function(data, textStatus, jQxhr) {
                                                    if (data.status === 'ok') {
                                                        var item = data.item;
                                                        var size = item.size;

                                                        var decryptedImageDataInUint8Array = decryptArrayBuffer(encryptedImageDataInArrayBuffer, itemKey, itemIV);
                                                        var link = window.URL.createObjectURL(new Blob([decryptedImageDataInUint8Array]), {
                                                            type: 'image/jpeg'
                                                        });
                                                        done(null);
                                                        // $img = $('<img class="img-responsive" src="' + link + '"' + '>');
                                                        // $img.on('load', function(e) {
                                                        //     var $thisImg = $(e.target);
                                                        //     $thisImg.data('width', $thisImg[0].width);
                                                        //     $thisImg.data('height', $thisImg[0].height);

                                                        //     var $imagePanel = $('.imagePanelTemplate').clone().removeClass('imagePanelTemplate hidden').addClass('imagePanel');
                                                        //     $imagePanel.find('.deleteImageBtn').attr('data-key', s3CommonKey).on('click', pageControlFunctions.deleteImageOnPage);
                                                        //     $imagePanel.attr('id', id);
                                                        //     $imagePanel.find('.image').append($thisImg);
                                                        //     var encryptedWords = $downloadImage.data('words');
                                                        //     if (encryptedWords) {
                                                        //         var encodedWords = decryptBinaryString(encryptedWords, itemKey, itemIV);
                                                        //         var words = forge.util.decodeUtf8(encodedWords);
                                                        //         words = DOMPurify.sanitize(words);
                                                        //         $imagePanel.find('.froala-editor').html(words);
                                                        //     }
                                                        //     $imagePanel.find('.btnWrite').on('click', handleBtnWriteClicked);
                                                        //     $imagePanel.find('.insertImages').on('change', insertImages);
                                                        //     $downloadImage.before($imagePanel);
                                                        //     $downloadImage.remove();

                                                        //     done(null);
                                                        // });
                                                        // $img.on('click', function(e) {
                                                        //     $thisImg = $(e.target);
                                                        //     $thisImagePanel = $thisImg.closest('.imagePanel');
                                                        //     var index = $thisImagePanel.attr('id');
                                                        //     var startingIndex = parseInt(index.split('-')[1]);
                                                        //     showGallery(startingIndex);
                                                        // });
                                                    }
                                                }, 'json');

                                            }
                                            ;

                                            xhr.send();
                                            //currentImageDownloadXhr = xhr;

                                        }
                                    }, 'json');

                                }
                                
                                var doneDownloadingAnImage = function(err) {
                                    if (err) {
                                        console.log(err);
                                        done(err);
                                    } else {
                                        index++;
                                        //if (index < $downloadImagesList.length) {
                                        if (index < item.images.length) {
                                            downloadAnImage(doneDownloadingAnImage);
                                        } else {
                                            done(null);
                                        }
                                    }
                                };

                                downloadAnImage(doneDownloadingAnImage);
                            }
                            
                            buildDownloadImagesList();
                            startDownloadingImages(function(err) {
                                if (err) {
                                    console.log(err);
                                } else {
                                    //$('.imageBtnRow').removeClass('hidden');
                                }
                            });

                        }                        
                        downloadAndDisplayImages();
                    }

                    var attachments = item.attachments;
                    dbSetTotalCountersOfPage(itemId, 'Attatchment', attachments.length-1);
                    for (var i = 1; i < attachments.length; i++) {
                        var attachment = attachments[i];
                        var encodedFileName = decryptBinaryString(attachment.fileName, itemKey, itemIV);
                        var fileName = forge.util.decodeUtf8(encodedFileName);
                        //var $attachment = showAttachment(fileName, attachment.size);
                        //$attachment.attr('id', attachment.s3KeyPrefix);
                        //changeDownloadingState($attachment, 'Attached');
                        //var $download = $attachment.find('.downloadBtn');
                        //$download.off();
                        //$download.click(queueDownloadEvent);
                        downloadAttachment(attachment.s3KeyPrefix);
                    }
                    if (!thisVersion || thisVersion === currentVersion) {
                        //enableEditControls();
                        /* initializeEditorButtons();
						initializeImageButton();
          				initializeAttachButton();
						*/
                    } else {
                        //disableEditControls();
                    }
                } // end function decryptItem()

                if (itemSpace.substring(0, 1) === 'u') {
                    $('.navbarTeamName').text("Yours");
                    decryptItem(expandedKey);
                    getPageComments();
                    done(null, item);
                } else {
                    isATeamItem = true;
                    var itemSpaceParts = itemSpace.split(':');
                    itemSpaceParts.splice(-2, 2);
                    teamId = itemSpaceParts.join(':');
                    getTeamData(teamId, function(err, team) {
                        if (err) {
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

                            decryptItem(teamKey);
                            getPageComments();
                            done(null, item);
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
                                    done(err);
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

                                    setupNewItemKey();
                                    console.log('err1');
                                    done(null, null);
                                }
                            });
                        } else {
                            setupNewItemKey();
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
            console.log('err4');
            done(data.err)
        }
        //hideLoadingPage();
    }, 'json');
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
            console.log('err4');
			done(data.err, null);
      		console.log('err:(getTeamData)', data.err);
		}
	}, 'json');
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
	}, 'json');
}

function downloadContentImageObjects(item_content, itemId) {
    downloadNextContentImageObject(item_content, itemId);
}
;
function downloadNextContentImageObject(item_content, itemId) {

    var encryptedImages = $(item_content).find(".bSafesImage");

    dbSetTotalCountersOfPage(itemId, 'ContentsImage', encryptedImages.length);
    for (var i = 0; i < encryptedImages.length; i++) {
        downloadImageObject($(encryptedImages[i]), itemId);
    }

}
;
function downloadImageObject(encryptedImageElement, itemId) {
    currentDownloadingImageElement = encryptedImageElement;
    currentDownloadingImageElement.addClass('bSafesDownloading');

    var id = currentDownloadingImageElement.attr('id');

    var s3CommonKey = id.split('&')[0];
    var s3Key = s3CommonKey + '_gallery';

    function displayImage(link) {
        var targetElement = $(document.getElementById(id));

        targetElement.on('load', function() {
            targetElement.addClass('bSafesDisplayed');
            var parent = targetElement.parent();
            if (parent.hasClass('downloadingImageContainer'))
                parent.replaceWith(targetElement);
        });
        targetElement.attr('src', link);
    }

    $.post(server_addr + '/memberAPI/preS3Download', {
        itemId: itemId,
        s3Key: s3Key
    }, function(data, textStatus, jQxhr) {
        if (data.status === 'ok') {
            var signedURL = data.signedURL;

            var xhr = new XMLHttpRequest();
            xhr.open('GET', signedURL, true);
            xhr.responseType = 'arraybuffer';

            xhr.addEventListener("progress", function(evt) {
                if (evt.lengthComputable) {
                    var percentComplete = evt.loaded / evt.total * 100;

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
				        dbInsertPageContentsFiles(server_addr + '/memberAPI/preS3Download', itemId, s3Key, file_name);
                        updatePageStatus(itemId, 'ContentsImage');
				        fs.close(fd, function() {
				            console.log('wrote the ContentsImage file successfully');
				        });
				    });
				});

                var encryptedImageDataInArrayBuffer = this.response;
               	

                $(document.getElementById('progressBar' + id)).parent().remove();
                $.post(server_addr + '/memberAPI/postS3Download', {
                    itemId: itemId,
                    s3Key: s3CommonKey
                }, function(data, textStatus, jQxhr) {
                    if (data.status === 'ok') {
                        var item = data.item;
                        var size = item.size;

                        var decryptedImageDataInUint8Array = decryptArrayBuffer(encryptedImageDataInArrayBuffer, itemKey, itemIV);
                        var link = window.URL.createObjectURL(new Blob([decryptedImageDataInUint8Array]), {
                            type: 'image/jpeg'
                        });
                        $downloadedElement = $(document.getElementById(id));
                        $downloadedElement.removeClass('bSafesDownloading');
                        displayImage(link);
                    } else {
                        console.log('err6');
                    }
                }, 'json');
            }
            ;

            xhr.send();

        }
    }, 'json');
}

function downloadVideoObject($videoDownload) {
    $videoDownload.off('click');
    $videoDownload.addClass('bSafesDownloading');
    var id = $videoDownload.attr('id');
    var s3Key = $videoDownload.attr('id').split('&')[0];

    // if (!currentEditor) {
    //     attachProgressBar($videoDownload);
    // }

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

                    console.log('downloadVideoObject', percentComplete);
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
                        updatePageStatus(itemId, 'Video');
                        fs.close(fd, function() {
                            console.log('wrote the Video file successfully');
                        });
                    });
                });

                // $(document.getElementById('progressBar' + id)).parent().remove();
                // var encryptedVideoDataInArrayBuffer = this.response;

                // decryptArrayBufferAsync(encryptedVideoDataInArrayBuffer, itemKey, itemIV, function(data) {
                //     videoBlob = new Blob([data],{
                //         type: "video/mp4"
                //     });
                //     videoLink = window.URL.createObjectURL(videoBlob);

                //     var $videoSpan = $('<span class="fr-video fr-draggable" contenteditable="false" draggable="true"><video class="bSafesVideo fr-draggable fr-dvi fr-fvc" controls="">Your browser does not support HTML5 video.</video></span>');
                //     var $video = $videoSpan.find('video');
                //     $video.attr('id', id);
                //     $video.attr('src', videoLink);
                //     var style = $videoDownload.attr('style');
                //     $video.attr('style', style);

                //     if ($videoDownload.hasClass('fr-dib'))
                //         $videoSpan.addClass('fr-dvb');
                //     if ($videoDownload.hasClass('fr-dii'))
                //         $videoSpan.addClass('fr-dvi');
                //     if ($videoDownload.hasClass('fr-fil'))
                //         $videoSpan.addClass('fr-fvl');
                //     if ($videoDownload.hasClass('fr-fic'))
                //         $videoSpan.addClass('fr-fvc');
                //     if ($videoDownload.hasClass('fr-fir'))
                //         $videoSpan.addClass('fr-fvr');

                //     var $targetElement = $(document.getElementById(id));
                //     // jQuery doesn't accept slashes in selector
                //     var $parent = $targetElement.parent();
                //     $parent.replaceWith($videoSpan);

                // });
            }
            ;

            xhr.send();

        } else {
            console.log('err6');
        }
    }, 'json');
}
;
function handleVideoObjects(item_content, itemId) {

    var videoDownloads = $(item_content).find(".bSafesDownloadVideo");

    dbSetTotalCountersOfPage(itemId, 'Video', videoDownloads.length);
    for (var i = 0; i < videoDownloads.length; i++) {
        downloadVideoObject($(videoDownloads[i]));
    }
}

function isImageDisplayed(imageElement) {
    var src = imageElement.attr('src');
    return src.indexOf('blob:') === 0;
}

var downloadAttachment = function(id) {
    //e.preventDefault();
    //var $downloadAttachment = $(e.target).parent();
    //var $attachment = $downloadAttachment.closest('.attachment');
    //var id = $attachment.attr('id');
    var fileName;
    var fileType;
    var fileSize;
    var numberOfChunks;
    var chunkIndex = 0;
    var decryptChunkIndex = 0;
    var decryptedFileInUint8Array;
    var decryptedFileIndex;
    var $decryptChunkDeferred = $.Deferred();
    var $decryptChunkPromise = $decryptChunkDeferred.promise();
    $decryptChunkDeferred.resolve();
    console.log('Download ', id);

    var downloadedFileProgress = 0;
    var $progress = $('.attachmentProgressTemplate').clone().removeClass('attachmentProgressTemplate hidden').addClass('attachmentProgressRow');
    //$progress.find('.progress-bar').css('width', 0);
    //$attachment.after($progress);

    //changeDownloadingState($attachment, 'Downloading');

    function downloadDecryptAndAssemble() {

        function enableResume() {
            changeDownloadingState($attachment, 'Stopped');
            var $resume = $attachment.find('.resumeBtn');
            $resume.off();
            $resume.click(function(e) {
                console.log('resuming downloading chunk:', chunkIndex);
                changeDownloadingState($attachment, 'Downloading');
                downloadDecryptAndAssemble();
            });
        }

        function downloadAChunk(signedURL) {
            var xhr = new XMLHttpRequest();
            var isDownloaded = false;
            
            xhr.open('GET', signedURL, true);
            xhr.responseType = 'arraybuffer';

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
                    //console.log('file progress:', attachmentFileProgress);
                }
            }, false);

            xhr.onload = function(e) {
            	var buffer = this.response;
				var file_name = uuidv1();
				var current_chunkIndex = chunkIndex;
				fs.open(download_folder_path + file_name, 'w', function(err, fd) {
				    if (err) {
				        throw 'could not open file: ' + err;
				    }
				    // write the contents of the buffer, from position 0 to the end, to the file descriptor returned in opening our file
				    fs.write(fd, new Buffer(buffer), 0, buffer.length, null, (err) => {
				        if (err) throw 'error writing file: ' + err;
				        dbInsertPageAttatchment(server_addr + '/memberAPI/preS3ChunkDownload', itemId, current_chunkIndex, id, data='', file_name);
                        updatePageStatus(itemId, 'Attatchment');
				        fs.close(fd, function() {
				            console.log('wrote the Attatchment file successfully');
				        });
				    });
				});

                var encryptedChunkInArrayBuffer = this.response;
                isDownloaded = true;
                console.log('isDownloaded:', isDownloaded);

                console.log('downloaded chunk size:', encryptedChunkInArrayBuffer.byteLength);
                console.log('Chunk downloaded:', chunkIndex);

                $decryptChunkPromise.done(function() {
                    chunkIndex++;
                    downloadedFileProgress = chunkIndex / numberOfChunks * 100;
                    if (chunkIndex < numberOfChunks)
                        downloadDecryptAndAssemble();
                    console.log('Decrypt Chunk:', decryptedFileIndex);
                    $decryptChunkDeferred = $.Deferred();
                    $decryptChunkPromise = $decryptChunkDeferred.promise();
                    decryptChunkInArrayBufferAsync(encryptedChunkInArrayBuffer, decryptedFileInUint8Array, decryptedFileIndex, itemKey, itemIV, function(err, decryptedChunkSize) {

                        if (err) {
                            alert(err);
                            $decryptChunkDeferred.reject();
                        } else {
                            //console.log('decryptedChunkSize', decryptedChunkSize);
                            decryptedFileIndex += decryptedChunkSize;
                            decryptChunkIndex += 1;
                            //console.log(decryptedFileIndex);
                            if (decryptChunkIndex === numberOfChunks) {
                                isDownloading = false;
                            }
                            $decryptChunkDeferred.resolve();
                        }
                    });
                });
            }
            ;

            xhr.onerror = xhr.onabort = function() {
                console.log('isDownloaded:', isDownloaded);
                if (isDownloaded)
                    return;
                enableResume();
            }
            ;

            xhr.send();
        }

        $.post(server_addr + '/memberAPI/preS3ChunkDownload', {
            itemId: itemId,
            chunkIndex: chunkIndex.toString(),
            s3KeyPrefix: id
        }, function(data, textStatus, jQxhr) {
            if (data.status === 'ok') {
            	dbInsertPageAttatchment(server_addr + '/memberAPI/preS3ChunkDownload', itemId, chunkIndex, id, data);
                console.log(data);
                if (chunkIndex === 0) {
                    var encodedFileName = decryptBinaryString(data.fileName, itemKey, itemIV);
                    //fileName = forge.util.decodeUtf8(encodedFileName);
                    fileType = data.fileType;
                    fileSize = data.fileSize;
                    numberOfChunks = parseInt(data.numberOfChunks);
                    decryptedFileInUint8Array = new Uint8Array(fileSize);
                    decryptedFileIndex = 0;
                }
                downloadAChunk(data.signedURL);
            } else {
                console.log('err6');
            }
        }, 'json').fail(function() {
            enableResume();
        });
        ;
    }

    downloadDecryptAndAssemble();

    return false;
}

function updatePageStatus(pageId, field)
{
    dbIncreaseDownloadedCountersOfPage(pageId, field, function(){
        dbupdatePageStatus(pageId, function(isCompleted) {
            if (isCompleted) {
                //arrPage.splice( arrPage.indexOf(pageId), 1 );
                currentPage = null;
            }
        });
    });
}