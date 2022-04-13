(function () {
    'use strict';

    angular.module('ariaNg').factory('ariaNgFileService', ['$q', '$window', function ($q, $window) {
        var isSupportFileReader = !!$window.FileReader;
        var isSupportBlob = !!$window.Blob;

        var getAllowedExtensions = function (fileFilter) {
            var extensions = [];

            if (!fileFilter || fileFilter.length < 1) {
                extensions.push(/.+$/);
                return extensions;
            }

            var fileFilters = fileFilter.split(',');

            for (var i = 0; i < fileFilters.length; i++) {
                var extension = fileFilters[i];

                if (extension === '*.*') {
                    extensions.push(/.+$/);
                    continue;
                }

                extension = extension.replace('.', '\\.');
                extension = extension + '$';

                extensions.push(new RegExp(extension));
            }

            return extensions;
        };

        var checkFileExtension = function (fileName, extensions) {
            if (!extensions || extensions.length < 1) {
                return true;
            }

            for (var i = 0; i < extensions.length; i++) {
                if (extensions[i].test(fileName)) {
                    return true;
                }
            }

            return false;
        };

        var uint8ToBase64 = function (u8Arr) {
            var CHUNK_SIZE = 0x8000; //arbitrary number
            var index = 0;
            var length = u8Arr.length;
            var result = '';
            var slice;
            while (index < length) {
                slice = u8Arr.subarray(index, Math.min(index + CHUNK_SIZE, length));
                result += String.fromCharCode.apply(null, slice);
                index += CHUNK_SIZE;
            }
            return btoa(result);
        }

        var readFile = function (file, allowedExtensions) {

            var deferred = $q.defer();
            var fileName = file.name;

            if (!checkFileExtension(fileName, allowedExtensions)) {
                deferred.reject('The selected file type is invalid!');
            }

            var reader = new FileReader();

            reader.onload = function () {
                var buff = new Uint8Array(this.result);
                var base64 = uint8ToBase64(buff);
                var result = {
                    fileName: fileName,
                    base64Content: base64
                };
                deferred.resolve(result);
            };

            reader.onerror = function () {
                deferred.reject("Failed to load file!");
            };

            reader.readAsArrayBuffer(file);

            return deferred.promise;
        };


        return {
            isSupportFileReader: function () {
                return isSupportFileReader;
            },
            isSupportBlob: function () {
                return isSupportBlob;
            },
            openMultipleFileContents: function (options, successCallback, errorCallback, element) {
                if (!isSupportFileReader) {
                    if (errorCallback) {
                        errorCallback('Your browser does not support loading file!');
                    }

                    return;
                }

                options = angular.extend({
                    scope: null,
                    fileFilter: null,
                    fileType: 'binary', // or 'text'
                    successCallback: successCallback,
                    errorCallback: errorCallback
                }, options);

                if (!element || !element.change) {
                    element = angular.element('<input type="file" style="display: none" multiple/>');
                }

                element.data('options', options);

                if (options.fileFilter) {
                    element.attr('accept', options.fileFilter);
                }

                element.val('');

                if (element.attr('data-ariang-file-initialized') !== 'true') {
                    element.change(function () {
                        if (!this.files || this.files.length < 1) {
                            return;
                        }

                        var thisOptions = element.data('options');
                        var allowedExtensions = getAllowedExtensions(thisOptions.fileFilter);
                        var file = this.files[0];
                        var fileName = file.name;

                        if (!checkFileExtension(fileName, allowedExtensions)) {
                            if (thisOptions.errorCallback) {
                                if (thisOptions.scope) {
                                    thisOptions.scope.$apply(function () {
                                        thisOptions.errorCallback('The selected file type is invalid!');
                                    });
                                } else {
                                    thisOptions.errorCallback('The selected file type is invalid!');
                                }
                            }

                            return;
                        }

                        // read files recursively
                        function addFiles(files, curFile) {

                            var nextFile = curFile + 1;
                            var done = files.length <= nextFile;

                            readFile(files[curFile], allowedExtensions)
                                .then(function (result) {
                                    // read file success
                                    if (done) {
                                        successCallback(result);
                                    } else {
                                        successCallback(result, function () {
                                            addFiles(files, nextFile);
                                        });
                                    }
                                })
                                .catch(function (error) {
                                    // read file fail
                                    errorCallback(error);
                                    if (!done) {
                                        addFiles(files, nextFile);
                                    }
                                });
                        };

                        addFiles(this.files, 0);
                    }).attr('data-ariang-file-initialized', 'true');
                }

                element.trigger('click');
            },
            openFileContent: function (options, successCallback, errorCallback, element) {
                if (!isSupportFileReader) {
                    if (errorCallback) {
                        errorCallback('Your browser does not support loading file!');
                    }

                    return;
                }

                options = angular.extend({
                    scope: null,
                    fileFilter: null,
                    fileType: 'binary', // or 'text'
                    successCallback: successCallback,
                    errorCallback: errorCallback
                }, options);

                if (!element || !element.change) {
                    element = angular.element('<input type="file" style="display: none"/>');
                }

                element.data('options', options);

                if (options.fileFilter) {
                    element.attr('accept', options.fileFilter);
                }

                element.val('');

                if (element.attr('data-ariang-file-initialized') !== 'true') {
                    element.change(function () {
                        if (!this.files || this.files.length < 1) {
                            return;
                        }

                        var thisOptions = element.data('options');
                        var allowedExtensions = getAllowedExtensions(thisOptions.fileFilter);
                        var file = this.files[0];
                        var fileName = file.name;

                        if (!checkFileExtension(fileName, allowedExtensions)) {
                            if (thisOptions.errorCallback) {
                                if (thisOptions.scope) {
                                    thisOptions.scope.$apply(function () {
                                        thisOptions.errorCallback('The selected file type is invalid!');
                                    });
                                } else {
                                    thisOptions.errorCallback('The selected file type is invalid!');
                                }
                            }

                            return;
                        }

                        var reader = new FileReader();

                        reader.onload = function () {
                            var result = {
                                fileName: fileName
                            };

                            switch (thisOptions.fileType) {
                                case 'text':
                                    result.content = this.result;
                                    break;
                                case 'binary':
                                default:
                                    result.base64Content = this.result.replace(/.*?base64,/, '');
                                    break;
                            }

                            if (thisOptions.successCallback) {
                                if (thisOptions.scope) {
                                    thisOptions.scope.$apply(function () {
                                        thisOptions.successCallback(result);
                                    });
                                } else {
                                    thisOptions.successCallback(result);
                                }
                            }
                        };

                        reader.onerror = function () {
                            if (thisOptions.errorCallback) {
                                if (thisOptions.scope) {
                                    thisOptions.scope.$apply(function () {
                                        thisOptions.errorCallback('Failed to load file!');
                                    });
                                } else {
                                    thisOptions.errorCallback('Failed to load file!');
                                }
                            }
                        };

                        switch (thisOptions.fileType) {
                            case 'text':
                                reader.readAsText(file);
                                break;
                            case 'binary':
                            default:
                                reader.readAsDataURL(file);
                                break;
                        }
                    }).attr('data-ariang-file-initialized', 'true');
                }

                element.trigger('click');
            },
            saveFileContent: function (content, element, options) {
                if (!isSupportBlob) {
                    return;
                }

                options = angular.extend({
                    fileName: null,
                    contentType: 'application/octet-stream',
                    autoTrigger: false,
                    autoRevoke: false
                }, options);

                var blob = new Blob([content], { type: options.contentType });
                var objectUrl = URL.createObjectURL(blob);

                if (!element) {
                    element = angular.element('<a style="display: none"/>');
                }

                element.attr('href', objectUrl);

                if (options.fileName) {
                    element.attr('download', options.fileName);
                }

                if (options.autoTrigger) {
                    element.trigger('click');
                }

                if (options.autoRevoke) {
                    URL.revokeObjectURL(objectUrl);
                }
            }
        };
    }]);
}());
