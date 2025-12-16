(function () {
    "use strict";

    angular.module("ariaNg").controller("TaskDetailController", [
        "$rootScope",
        "$scope",
        "$routeParams",
        "$interval",
        "clipboard",
        "aria2RpcErrors",
        "ariaNgFileTypes",
        "ariaNgCommonService",
        "ariaNgSettingService",
        "ariaNgMonitorService",
        "aria2TaskService",
        "aria2SettingService",
        function (
            $rootScope,
            $scope,
            $routeParams,
            $interval,
            clipboard,
            aria2RpcErrors,
            ariaNgFileTypes,
            ariaNgCommonService,
            ariaNgSettingService,
            ariaNgMonitorService,
            aria2TaskService,
            aria2SettingService
        ) {
            var tabStatusItems = [
                {
                    name: "overview",
                    show: true,
                },
                {
                    name: "pieces",
                    show: true,
                },
                {
                    name: "filelist",
                    show: true,
                },
                {
                    name: "btpeers",
                    show: true,
                },
            ];
            var downloadTaskRefreshPromise = null;
            var pauseDownloadTaskRefresh = false;
            var currentRowTriggeredMenu = null;

            var getVisibleTabOrders = function () {
                var items = [];

                for (var i = 0; i < tabStatusItems.length; i++) {
                    if (tabStatusItems[i].show) {
                        items.push(tabStatusItems[i].name);
                    }
                }

                return items;
            };

            var setTabItemShow = function (name, status) {
                for (var i = 0; i < tabStatusItems.length; i++) {
                    if (tabStatusItems[i].name === name) {
                        tabStatusItems[i].show = status;
                        break;
                    }
                }
            };

            var getAvailableOptions = function (status, isBittorrent) {
                var keys = aria2SettingService.getAvailableTaskOptionKeys(
                    status,
                    isBittorrent
                );

                return aria2SettingService.getSpecifiedOptions(keys, {
                    disableRequired: true,
                });
            };

            var isShowPiecesInfo = function (task) {
                var showPiecesInfoSetting =
                    ariaNgSettingService.getShowPiecesInfoInTaskDetailPage();

                if (!task || showPiecesInfoSetting === "never") {
                    return false;
                }

                if (showPiecesInfoSetting === "le102400") {
                    return task.numPieces <= 102400;
                } else if (showPiecesInfoSetting === "le10240") {
                    return task.numPieces <= 10240;
                } else if (showPiecesInfoSetting === "le1024") {
                    return task.numPieces <= 1024;
                }

                return true; // showPiecesInfoSetting === 'always'
            };

            var processTask = function (task) {
                if (!task) {
                    return;
                }

                $scope.context.showPiecesInfo = isShowPiecesInfo(task);
                $scope.context.fileInfos = getFileInfos(task);

                setTabItemShow("pieces", $scope.context.showPiecesInfo);
                setTabItemShow(
                    "btpeers",
                    task.status === "active" && task.bittorrent
                );

                if (!$scope.task || $scope.task.status !== task.status) {
                    $scope.context.availableOptions = getAvailableOptions(
                        task.status,
                        !!task.bittorrent
                    );
                }

                if ($scope.task) {
                    delete $scope.task.verifiedLength;
                    delete $scope.task.verifyIntegrityPending;
                }

                $scope.task = ariaNgCommonService.copyObjectTo(
                    task,
                    $scope.task
                );

                $rootScope.taskContext.list = [$scope.task];
                $rootScope.taskContext.selected = {};
                $rootScope.taskContext.selected[$scope.task.gid] = true;

                ariaNgMonitorService.recordStat(task.gid, task);
            };

            var processPeers = function (peers) {
                if (!peers) {
                    return;
                }

                if (
                    !ariaNgCommonService.extendArray(
                        peers,
                        $scope.context.btPeers,
                        "peerId"
                    )
                ) {
                    $scope.context.btPeers = peers;
                }

                $scope.context.healthPercent =
                    aria2TaskService.estimateHealthPercentFromPeers(
                        $scope.task,
                        $scope.context.btPeers
                    );
            };

            var requireBtPeers = function (task) {
                return task && task.bittorrent && task.status === "active";
            };

            var refreshDownloadTask = function (silent) {
                if (pauseDownloadTaskRefresh) {
                    return;
                }

                var processError = function (message) {
                    $interval.cancel(downloadTaskRefreshPromise);
                };

                var includeLocalPeer = true;
                var addVirtualFileNode = true;

                if (!$scope.task) {
                    return aria2TaskService.getTaskStatus(
                        $routeParams.gid,
                        function (response) {
                            if (!response.success) {
                                return processError(response.data.message);
                            }

                            var task = response.data;

                            processTask(task);

                            if (requireBtPeers(task)) {
                                aria2TaskService.getBtTaskPeers(
                                    task,
                                    function (response) {
                                        if (response.success) {
                                            processPeers(response.data);
                                        }
                                    },
                                    silent,
                                    includeLocalPeer
                                );
                            }
                        },
                        silent,
                        addVirtualFileNode
                    );
                } else {
                    return aria2TaskService.getTaskStatusAndBtPeers(
                        $routeParams.gid,
                        function (response) {
                            if (!response.success) {
                                return processError(response.data.message);
                            }

                            processTask(response.task);
                            processPeers(response.peers);
                        },
                        silent,
                        requireBtPeers($scope.task),
                        includeLocalPeer,
                        addVirtualFileNode
                    );
                }
            };

            const extensionLookupTable = (function () {
                const t = {};
                for (var type in ariaNgFileTypes) {
                    if (!ariaNgFileTypes.hasOwnProperty(type)) {
                        continue;
                    }

                    var o = ariaNgFileTypes[type];
                    for (var ext of o.extensions) {
                        t[ext] = o.name;
                    }
                }
                return t;
            })();

            var refreshFileList = function (selectedFileIndex) {
                var gid = $scope.task.gid;
                pauseDownloadTaskRefresh = true;

                return aria2TaskService.selectTaskFile(
                    gid,
                    selectedFileIndex,
                    function (response) {
                        pauseDownloadTaskRefresh = false;

                        if (response.success) {
                            refreshDownloadTask(false);
                        }
                    },
                    false
                );
            };

            var selectInvert = function () {
                if (!$scope.task || !$scope.task.files) {
                    return;
                }

                var selectedFileIndex = [];
                for (var i = 0; i < $scope.task.files.length; i++) {
                    var file = $scope.task.files[i];
                    if (file && !file.isDir && !file.selected) {
                        selectedFileIndex.push(file.index);
                    }
                }

                return refreshFileList(selectedFileIndex);
            };

            var selectCompleted = function () {
                if (!$scope.task || !$scope.task.files) {
                    return;
                }

                var selectedFileIndex = [];
                for (var i = 0; i < $scope.task.files.length; i++) {
                    var file = $scope.task.files[i];
                    if (file && !file.isDir && file.completedLength >= file.length) {
                        selectedFileIndex.push(file.index);
                    }
                }

                return refreshFileList(selectedFileIndex);
            };

            var selectAllFiles = function () {
                if (!$scope.task || !$scope.task.files) {
                    return;
                }

                var selectedFileIndex = [];
                for (var i = 0; i < $scope.task.files.length; i++) {
                    var file = $scope.task.files[i];
                    if (file && !file.isDir) {
                        selectedFileIndex.push(file.index);
                    }
                }

                return refreshFileList(selectedFileIndex);
            };

            var selectLargestOne = function () {
                if (!$scope.task || !$scope.task.files) {
                    return;
                }

                var cand = $scope.task.files.filter(f => !f.isDir);
                cand.sort((a, b) => b.length - a.length);
                var first = cand[0]
                var idxs = first ? [first.index] : []
                return refreshFileList(idxs);
            }

            var selectGreedyTop = function (percent) {
                if (!$scope.task || !$scope.task.files) {
                    return;
                }

                var cand = $scope.task.files.filter(f => !f.isDir);
                cand.sort((a, b) => b.length - a.length);
                var total = cand.reduce((s, f) => s + f.length, 0);
                var max = total / 100 * percent;
                if (!cand || !cand.length || !max) {
                    return;
                }

                var selectedFileIndex = [];
                for (var i = 0; i < cand.length && max > 0; i++) {
                    var file = cand[i];
                    selectedFileIndex.push(file.index);
                    max = max - file.length;
                }
                return refreshFileList(selectedFileIndex);
            }

            var selectExtensionGroup = function (tag, checked, excluded) {
                if (!$scope.task || !$scope.task.files) {
                    return;
                }

                var files = $scope.task.files;
                var cats = $scope.context.fileInfos.cats;
                var exts = null;
                for (let cat of cats) {
                    if (cat.tag === tag) {
                        exts = cat.etags;
                        break;
                    }
                }
                if (!exts || exts.length < 1) {
                    return;
                }

                var selectedFileIndex = [];
                for (var i = 0; i < files.length; i++) {
                    var file = files[i];
                    if (file && !file.isDir) {
                        var selected = excluded ? false : file.selected;
                        var name = (file.fileName || "").toLowerCase();
                        var ext = ariaNgCommonService.getFileExtension(name);
                        if (exts.indexOf(ext) >= 0) {
                            selected = checked ? true : false;
                        }
                        if (selected) {
                            selectedFileIndex.push(file.index);
                        }
                    }
                }

                return refreshFileList(selectedFileIndex);
            };

            var selectByExtension = function (tag, checked) {
                if (!$scope.task || !$scope.task.files) {
                    return;
                }

                var files = $scope.task.files;
                var selectedFileIndex = [];
                for (var i = 0; i < files.length; i++) {
                    var file = files[i];
                    if (file && !file.isDir) {
                        var selected = file.selected;
                        var name = (file.fileName || "").toLowerCase();
                        var ext = ariaNgCommonService.getFileExtension(name);
                        if (tag === ext) {
                            selected = checked ? true : false;
                        }
                        if (selected) {
                            selectedFileIndex.push(file.index);
                        }
                    }
                }

                return refreshFileList(selectedFileIndex);
            };

            var addToFileInfosDB = function (db, sizes, file) {
                var name = (file.fileName || "").toLowerCase();
                var ext = ariaNgCommonService.getFileExtension(name);

                var cat = "Other";
                if (ext in extensionLookupTable) {
                    cat = extensionLookupTable[ext];
                }

                var size = file.length;
                sizes.total += size;

                var ds = 0;
                if (file.selected) {
                    ds = 1;
                    sizes.selected += size;
                    sizes.completed += file.completedLength;
                }

                if (!(cat in db)) {
                    db[cat] = {
                        tag: cat,
                        selected: 0,
                        count: 0,
                        completedSize: 0,
                        size: 0,

                        tmp: {},
                    };
                }

                var c = db[cat];
                c.selected += ds;
                c.count += 1;
                c.completedSize += file.completedLength;
                c.size += size;

                if (!(ext in c.tmp)) {
                    c.tmp[ext] = {
                        tag: ext,
                        selected: 0,
                        count: 0,
                        completedSize: 0,
                        size: 0,
                    };
                }

                var e = c.tmp[ext];
                e.selected += ds;
                e.count += 1;
                e.completedSize += file.completedLength;
                e.size += size;
            };

            var translateFileInfosDB = function (db, sizes) {
                var cats = [];

                for (var key in db) {
                    var c = db[key];
                    c["checked"] = c.selected > 0;

                    var exts = [];
                    var eTags = [];
                    for (var ek in c.tmp) {
                        var tmpe = c.tmp[ek];
                        tmpe["checked"] = tmpe.selected > 0;
                        eTags.push(ek);
                        exts.push(tmpe);
                    }
                    c["exts"] = exts;
                    c["etags"] = eTags;
                    delete c.tmp;

                    cats.push(c);
                }

                sizes["remain"] = sizes.total - sizes.selected;
                sizes["completedPercent"] =
                    (sizes.completed / sizes.selected) * 100;

                return {
                    cats: cats,
                    sizes: sizes,
                };
            };

            var getFileInfos = function (task) {
                var fileInfos = {};
                if (!task || !task.files) {
                    return fileInfos;
                }

                var counter = {
                    selected: 0,
                    completed: 0,
                    total: 0,
                };

                var sizes = {
                    total: 0,
                    selected: 0,
                    completed: 0,
                };
                var files = task.files;
                for (var i = 0; i < files.length; i++) {
                    var file = files[i];

                    if (file.isDir) {
                        continue;
                    }
                    counter.selected += file.selected ? 1 : 0;
                    counter.completed += file.completePercent >= 100;
                    counter.total++;
                    addToFileInfosDB(fileInfos, sizes, file);
                }

                var info = translateFileInfosDB(fileInfos, sizes);
                info["counter"] = counter;
                return info;
            };

            var setSelectFiles = function (silent) {
                if (!$scope.task || !$scope.task.files) {
                    return;
                }

                var gid = $scope.task.gid;
                var selectedFileIndex = [];

                for (var i = 0; i < $scope.task.files.length; i++) {
                    var file = $scope.task.files[i];

                    if (file && file.selected && !file.isDir) {
                        selectedFileIndex.push(file.index);
                    }
                }

                pauseDownloadTaskRefresh = true;

                return aria2TaskService.selectTaskFile(
                    gid,
                    selectedFileIndex,
                    function (response) {
                        pauseDownloadTaskRefresh = false;

                        if (response.success) {
                            refreshDownloadTask(false);
                        }
                    },
                    silent
                );
            };

            var setSelectedNode = function (node, value) {
                if (!node) {
                    return;
                }

                if (node.files && node.files.length) {
                    for (var i = 0; i < node.files.length; i++) {
                        var fileNode = node.files[i];
                        fileNode.selected = value;
                    }
                }

                if (node.subDirs && node.subDirs.length) {
                    for (var i = 0; i < node.subDirs.length; i++) {
                        var dirNode = node.subDirs[i];
                        setSelectedNode(dirNode, value);
                    }
                }

                node.selected = value;
                node.partialSelected = false;
            };

            var updateDirNodeSelectedStatus = function (node) {
                if (!node) {
                    return;
                }

                var selectedSubNodesCount = 0;
                var partitalSelectedSubNodesCount = 0;

                if (node.files && node.files.length) {
                    for (var i = 0; i < node.files.length; i++) {
                        var fileNode = node.files[i];
                        selectedSubNodesCount += fileNode.selected ? 1 : 0;
                    }
                }

                if (node.subDirs && node.subDirs.length) {
                    for (var i = 0; i < node.subDirs.length; i++) {
                        var dirNode = node.subDirs[i];
                        updateDirNodeSelectedStatus(dirNode);
                        selectedSubNodesCount += dirNode.selected ? 1 : 0;
                        partitalSelectedSubNodesCount += dirNode.partialSelected
                            ? 1
                            : 0;
                    }
                }

                node.selected =
                    selectedSubNodesCount > 0 &&
                    selectedSubNodesCount ===
                    node.subDirs.length + node.files.length;
                node.partialSelected =
                    (selectedSubNodesCount > 0 &&
                        selectedSubNodesCount <
                        node.subDirs.length + node.files.length) ||
                    partitalSelectedSubNodesCount > 0;
            };

            var updateAllDirNodesSelectedStatus = function () {
                if (!$scope.task || !$scope.task.multiDir) {
                    return;
                }

                for (var i = 0; i < $scope.task.files.length; i++) {
                    var node = $scope.task.files[i];

                    if (!node.isDir) {
                        continue;
                    }

                    updateDirNodeSelectedStatus(node);
                }
            };

            $scope.context = {
                currentTab: "filelist",
                isEnableSpeedChart:
                    ariaNgSettingService.getDownloadTaskRefreshInterval() > 0,
                showPiecesInfo:
                    ariaNgSettingService.getShowPiecesInfoInTaskDetailPage() !==
                    "never",
                showChooseFilesToolbar: false,
                collapsedDirs: {},
                btPeers: [],
                healthPercent: 0,
                collapseTrackers: true,
                statusData: ariaNgMonitorService.getEmptyStatsData(
                    $routeParams.gid
                ),
                availableOptions: [],
                options: [],

                fileInfos: {},
                fileFilter: "Show All",
            };

            $scope.setFileFilter = function (type) {
                $scope.context.fileFilter = type;
            };

            $scope.changeTab = function (tabName) {
                if (tabName === "settings") {
                    $scope.loadTaskOption($scope.task);
                }

                $scope.context.currentTab = tabName;
            };

            $rootScope.swipeActions.extendLeftSwipe = function () {
                var tabItems = getVisibleTabOrders();
                var tabIndex = tabItems.indexOf($scope.context.currentTab);

                if (tabIndex < tabItems.length - 1) {
                    $scope.changeTab(tabItems[tabIndex + 1]);
                    return true;
                } else {
                    return false;
                }
            };

            $rootScope.swipeActions.extendRightSwipe = function () {
                var tabItems = getVisibleTabOrders();
                var tabIndex = tabItems.indexOf($scope.context.currentTab);

                if (tabIndex > 0) {
                    $scope.changeTab(tabItems[tabIndex - 1]);
                    return true;
                } else {
                    return false;
                }
            };

            $scope.changeFileListDisplayOrder = function (
                type,
                autoSetReverse
            ) {
                if ($scope.task && $scope.task.multiDir) {
                    return;
                }

                var oldType = ariaNgCommonService.parseOrderType(
                    ariaNgSettingService.getFileListDisplayOrder()
                );
                var newType = ariaNgCommonService.parseOrderType(type);

                if (autoSetReverse && newType.type === oldType.type) {
                    newType.reverse = !oldType.reverse;
                }

                ariaNgSettingService.setFileListDisplayOrder(
                    newType.getValue()
                );
            };

            $scope.isSetFileListDisplayOrder = function (type) {
                var orderType = ariaNgCommonService.parseOrderType(
                    ariaNgSettingService.getFileListDisplayOrder()
                );
                var targetType = ariaNgCommonService.parseOrderType(type);

                return orderType.equals(targetType);
            };

            $scope.getFileListOrderType = function () {
                if ($scope.task && $scope.task.multiDir) {
                    return null;
                }

                return ariaNgSettingService.getFileListDisplayOrder();
            };

            $scope.showChooseFilesToolbar = function () {
                if (!$scope.context.showChooseFilesToolbar) {
                    pauseDownloadTaskRefresh = true;
                    $scope.context.showChooseFilesToolbar = true;
                } else {
                    $scope.cancelChooseFiles();
                }
            };

            $scope.isAnyFileSelected = function () {
                if (!$scope.task || !$scope.task.files) {
                    return false;
                }

                for (var i = 0; i < $scope.task.files.length; i++) {
                    var file = $scope.task.files[i];

                    if (!file.isDir && file.selected) {
                        return true;
                    }
                }

                return false;
            };

            $scope.isAllFileSelected = function () {
                if (!$scope.task || !$scope.task.files) {
                    return false;
                }

                for (var i = 0; i < $scope.task.files.length; i++) {
                    var file = $scope.task.files[i];

                    if (!file.isDir && !file.selected) {
                        return false;
                    }
                }

                return true;
            };

            $scope.showCustomChooseFileModal = function () {
                if (!$scope.task || !$scope.task.files) {
                    return;
                }
                angular.element("#custom-choose-file-modal").modal();
            };

            $scope.isFileVisible = function (file) {
                if (file.isDir) {
                    return true;
                }

                if ($scope.context.collapsedDirs[file.relativePath]) {
                    return false;
                }

                var name = (file.fileName || "").toLowerCase();
                var keyword = (
                    $rootScope.searchContext.text || ""
                ).toLowerCase();
                if (keyword !== "" && name.indexOf(keyword) < 0) {
                    return false;
                }

                var fileFilter = $scope.context.fileFilter;
                if (fileFilter === "Show All") {
                    return true;
                }

                if (fileFilter === "Show Selected") {
                    return file.selected;
                }

                if (fileFilter === "Show Uncompleted") {
                    return file.selected && file.completedLength < file.length;
                }

                var ext = ariaNgCommonService.getFileExtension(name);
                if (ext in extensionLookupTable) {
                    return extensionLookupTable[ext] === fileFilter;
                }

                for (let cat of $scope.context.fileInfos.cats) {
                    if (cat.etags.indexOf(ext) >= 0) {
                        return cat.tag === fileFilter;
                    }
                }
                return false;
            };

            $scope.isExtensionFilterDisabled = function () {
                if (
                    !$scope.task ||
                    !$scope.task.files ||
                    $scope.task.files.length <= 1
                ) {
                    return true;
                }

                if (
                    $scope.task.status === "waiting" ||
                    $scope.task.status === "paused"
                ) {
                    return false;
                }

                return true;
            };

            $scope.selectInvert = function () {
                $rootScope.loadPromise = selectInvert();
            };

            $scope.selectCompleted = function () {
                $rootScope.loadPromise = selectCompleted();
            };

            $scope.selectAllFiles = function () {
                $rootScope.loadPromise = selectAllFiles();
            };

            $scope.selectLargestOne = function () {
                $rootScope.loadPromise = selectLargestOne();
            };

            $scope.selectGreedyTop = function (percent) {
                $rootScope.loadPromise = selectGreedyTop(percent);
            };

            $scope.selectExtensionGroup = function (name, checked, excluded) {
                $rootScope.loadPromise = selectExtensionGroup(
                    name,
                    checked,
                    excluded
                );
            };

            $scope.selectByExtension = function (extension, checked) {
                $rootScope.loadPromise = selectByExtension(extension, checked);
            };

            $scope.setSelectedFile = function (updateNodeSelectedStatus) {
                if (updateNodeSelectedStatus) {
                    updateAllDirNodesSelectedStatus();
                }

                if (!$scope.context.showChooseFilesToolbar) {
                    setSelectFiles(true);
                }
            };

            $scope.collapseDir = function (dirNode, newValue, forceRecurse) {
                var nodePath = dirNode.nodePath;

                if (angular.isUndefined(newValue)) {
                    newValue = !$scope.context.collapsedDirs[nodePath];
                }

                if (newValue || forceRecurse) {
                    for (var i = 0; i < dirNode.subDirs.length; i++) {
                        $scope.collapseDir(dirNode.subDirs[i], newValue);
                    }
                }

                if (nodePath) {
                    $scope.context.collapsedDirs[nodePath] = newValue;
                }
            };

            $scope.collapseAllDirs = function (newValue) {
                if (!$scope.task || !$scope.task.files) {
                    return;
                }

                for (var i = 0; i < $scope.task.files.length; i++) {
                    var node = $scope.task.files[i];

                    if (!node.isDir) {
                        continue;
                    }

                    $scope.collapseDir(node, newValue, true);
                }
            };

            $scope.setSelectedNode = function (dirNode) {
                setSelectedNode(dirNode, dirNode.selected);
                updateAllDirNodesSelectedStatus();

                if (!$scope.context.showChooseFilesToolbar) {
                    $scope.setSelectedFile(false);
                }
            };

            $scope.changePeerListDisplayOrder = function (
                type,
                autoSetReverse
            ) {
                var oldType = ariaNgCommonService.parseOrderType(
                    ariaNgSettingService.getPeerListDisplayOrder()
                );
                var newType = ariaNgCommonService.parseOrderType(type);

                if (autoSetReverse && newType.type === oldType.type) {
                    newType.reverse = !oldType.reverse;
                }

                ariaNgSettingService.setPeerListDisplayOrder(
                    newType.getValue()
                );
            };

            $scope.isSetPeerListDisplayOrder = function (type) {
                var orderType = ariaNgCommonService.parseOrderType(
                    ariaNgSettingService.getPeerListDisplayOrder()
                );
                var targetType = ariaNgCommonService.parseOrderType(type);

                return orderType.equals(targetType);
            };

            $scope.getPeerListOrderType = function () {
                return ariaNgSettingService.getPeerListDisplayOrder();
            };

            $scope.loadTaskOption = function (task) {
                $rootScope.loadPromise = aria2TaskService.getTaskOptions(
                    task.gid,
                    function (response) {
                        if (response.success) {
                            $scope.context.options = response.data;
                        }
                    }
                );
            };

            $scope.setOption = function (key, value, optionStatus) {
                return aria2TaskService.setTaskOption(
                    $scope.task.gid,
                    key,
                    value,
                    function (response) {
                        if (response.success && response.data === "OK") {
                            optionStatus.setSuccess();
                        } else {
                            optionStatus.setFailed(response.data.message);
                        }
                    },
                    true
                );
            };

            $scope.copySelectedRowText = function () {
                if (!currentRowTriggeredMenu) {
                    return;
                }

                var name = currentRowTriggeredMenu
                    .find(".setting-key > span")
                    .text()
                    .trim();
                var value = "";

                currentRowTriggeredMenu
                    .find(".setting-value > span")
                    .each(function (i, element) {
                        if (i > 0) {
                            value += "\n";
                        }

                        value += angular.element(element).text().trim();
                    });

                if (
                    ariaNgSettingService.getIncludePrefixWhenCopyingFromTaskDetails()
                ) {
                    var info = name + ": " + value;
                    clipboard.copyText(info);
                } else {
                    clipboard.copyText(value);
                }
            };

            if (ariaNgSettingService.getDownloadTaskRefreshInterval() > 0) {
                downloadTaskRefreshPromise = $interval(function () {
                    if (
                        $scope.task &&
                        ($scope.task.status === "complete" ||
                            $scope.task.status === "error" ||
                            $scope.task.status === "removed")
                    ) {
                        $interval.cancel(downloadTaskRefreshPromise);
                        return;
                    }

                    refreshDownloadTask(true);
                }, ariaNgSettingService.getDownloadTaskRefreshInterval());
            }

            $scope.$on("$destroy", function () {
                if (downloadTaskRefreshPromise) {
                    $interval.cancel(downloadTaskRefreshPromise);
                }
            });

            $scope.onOverviewMouseDown = function () {
                angular
                    .element('#overview-items .row[contextmenu-bind!="true"]')
                    .contextmenu({
                        target: "#task-overview-contextmenu",
                        before: function (e, context) {
                            currentRowTriggeredMenu = context;
                        },
                    })
                    .attr("contextmenu-bind", "true");
            };

            angular
                .element("#task-overview-contextmenu")
                .on("hide.bs.context", function () {
                    currentRowTriggeredMenu = null;
                });

            $rootScope.loadPromise = refreshDownloadTask(false);
        },
    ]);
})();
