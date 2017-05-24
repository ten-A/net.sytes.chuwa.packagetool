/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets, window */

// Extension Tool for Adobe Extensions SDK
define(function (require, exports, module) {
    'use strict';

    var CommandManager      = brackets.getModule("command/CommandManager");
    var DocumentManager     = brackets.getModule("document/DocumentManager");
    var Menus               = brackets.getModule("command/Menus");
    var ProjectManager      = brackets.getModule("project/ProjectManager");
    var FileUtils           = brackets.getModule("file/FileUtils");
    var FileSystem          = brackets.getModule("filesystem/FileSystem");
    var Dialogs             = brackets.getModule("widgets/Dialogs");
    var ExtensionUtils      = brackets.getModule("utils/ExtensionUtils");
    var AppInit             = brackets.getModule("utils/AppInit");
    var NodeConnection      = brackets.getModule("utils/NodeConnection");
    
    var PreferencesManager = brackets.getModule("preferences/PreferencesManager");
    var prefs = PreferencesManager.getExtensionPrefs("CEPExtensionTool");


    var PanelTemplate       = require("text!panel.html");
    var context = {title:"Package Current Extension", cert:"Certificate"};

    var alertTemplate = require("text!alert-dialog.html");
    var msg = {title:"Warning.",message:"sample string"};


    var ET_MENU_ID  = "ExtensionTool.menu";
    var ET_MENU_NAME = "Extension Tool";
    var ET_CMDID  = "ExtensionTool.deploy";
    var ET_MENU_NAME   = "Package Current Project";
    var ET_SELECT_SIGNCMD_ID = "ExtensionTool.selectSignTool";
    var ET_SELECT_SIGNCMD_NAME = "Select ZXPSignCmd Tool";
    
    
    var EXT_FOLDER_NAME = "/ExtensionTool/";
    var NODE_DOMAIN_LOCATION = "node/extToolDomain";

    var isWin = false;
    var userHomeDir;
    var nodeConnection;
    var moduleFolder;
    var exttoolFolder;


    function initNodeDomain() {
        var promise = nodeConnection.domains.exttool.initialize();
        promise.fail(function (err) {
            console.error("[brackets-exttool-node] failed to run exttool.initialize", err);
        });
        promise.done(function (path) {
            console.log("Home directory: " + path);
            userHomeDir = path;
        });
        return promise;
    }

    function initNodeCnx() {
        nodeConnection = new NodeConnection();
        var connectionPromise = nodeConnection.connect(true);
        connectionPromise.fail(function () {
            console.error("[brackets-exttool-node] failed to connect to node");
        });
        connectionPromise.done(function () {
            var path = ExtensionUtils.getModulePath(module, NODE_DOMAIN_LOCATION);

            var loadPromise = nodeConnection.loadDomains([path], true);
            loadPromise.fail(function () {
                console.log("[brackets-exttool-node] failed to load domain");
            });
            loadPromise.done(function () {
                initNodeDomain();
            });
        });
            
    }


    function createPackage(){
        console.log("start packaging...");
        var context = {
            certificatePassword: false,
            Certificate: false,
            OutputDirectory: false
        };
        var cntx = {
            title:'Package Current Extension Project.',
            cert:'Certificate'
        };
        var dialog = Dialogs.showModalDialogUsingTemplate(Mustache.render(PanelTemplate,cntx), false);
       ExtensionUtils.loadStyleSheet(module, "main.css");
        $("#cancel").on("click", function (e) {
            dialog.close();
        });
        $("#selectcertificate").on("click", function (e) {
            FileSystem.showOpenDialog(false, false, "Select certificate file", null, null, 
                function(err, certificate) {
                    if (err || (!err && certificate.length === 0)) {
                        console.log("Err or dialog cancelled");
                    } else {
                        context.Certificate = certificate;
                        $("#certificate").val(certificate);
                    }
            });
        });
        $("#selectoutput").on("click", function (e) {
            FileSystem.showOpenDialog(false, true, "Select output directory", null, null, 
                function(err, outputDirectory) {
                    if (err || (!err && outputDirectory.length === 0)) {
                        console.log("Err or dialog cancelled");
                    } else {
                       context.OutputDirectory = outputDirectory;
                        $("#outputdir").val(outputDirectory);
                    }
            });
        });

        $("#package").click(function() {
            context.certificatePassword = $("#certpass").val();
            context.OutputDirectory = $("#outputdir").val();
            context.Certificate = $("#certificate").val();
            if (!context.certificatePassword || !context.Certificate || !context.OutputDirectory) {
                //$("#outputdir").style.borderColor = "red";
                //$("#certificate").style.borderColor = "red";
            } else {
                dialog.close();
                var options = {
                    certificatePassword: context.certificatePassword,
                    certificatePath: context.Certificate.replace(/\s/g, "\\ "),
                    extensionName: ProjectManager.getProjectRoot()._name,
                    extensionPath: ProjectManager.getProjectRoot()._parentPath.replace(/\s/g, "\\ ") + "" + ProjectManager.getProjectRoot()._name.replace(/\s/g, "\\ ") + "/",
                    zxpPath: context.OutputDirectory.replace(/\s/g, "\\ ") + "/" +
                    ProjectManager.getProjectRoot()._name.replace(/\s+/g, "") + ".zxp"
                    };
                    console.log("Options: " + JSON.stringify(options));
                    makePackage(options);
            }
        });
    }

    function makePackage(data) {
        var cmd;
        if(isWin) {
            //At this release, Windows disabled. Please wait next update.
            //cmd = '"exttoolFolder.fullPath.replace(/\s+/g, "\ ") + "ZXPSignCmd.exe" + '" default ' + data.extid + "'";
        } else {
            cmd = prefs.get("signCmd").replace(/\s+/g, "\\ ") + " -sign "
                + data.extensionPath + " " + data.zxpPath
                + " " + data.certificatePath + " " +data.certificatePassword
                + " -tsa http://time.certum.pl";
        } 
        console.log("Brackets cmd:"+cmd);
        var exePromise = nodeConnection.domains.exttool.execmd(cmd);
        exePromise.fail(function (err) {
            msg.title = "Fail to Package";
            msg.message = "ErrorCode = " + err.code;
            var dialog = Dialogs.showModalDialogUsingTemplate(Mustache.render(alertTemplate,msg), true);
            ExtensionUtils.loadStyleSheet(module, "main.css");
            console.error("[brackets-ccext-node] failed to run exttool.execmd", err);
        });
        exePromise.done(function (stdout) {
            console.log(stdout);
            msg.title = "Result...";
            msg.message = stdout;
            var dialog = Dialogs.showModalDialogUsingTemplate(Mustache.render(alertTemplate,msg), true);
            ExtensionUtils.loadStyleSheet(module, "main.css");
        });
    }

    AppInit.appReady(function () {
        isWin = (brackets.platform!="mac");
        moduleFolder = FileUtils.getNativeModuleDirectoryPath(module);
        exttoolFolder = new FileSystem.getDirectoryForPath(moduleFolder + EXT_FOLDER_NAME); 
        initNodeCnx();
    });

    function setupMenu(){
        CommandManager.register(ET_SELECT_SIGNCMD_NAME, ET_SELECT_SIGNCMD_ID, selectSignCmd);
        function selectSignCmd(){
            FileSystem.showOpenDialog(false, false, "Select ZXPSignCmd file...", null, null, 
                function(err, signcmd) {
                    if (err || (!err && signcmd.length === 0)) {
                        console.log("Err or dialog cancelled");
                    } else {
                        prefs.set("signCmd", signcmd[0]);
                    }
            });
        }

        CommandManager.register(ET_MENU_NAME, ET_CMDID,
            function(){
                createPackage();
            });

        var expackMenu =  Menus.getMenu(ET_MENU_ID);
        if (!expackMenu) {
            expackMenu = Menus.addMenu(ET_MENU_NAME, ET_MENU_ID, Menus.LAST);
        }


        expackMenu.addMenuItem(ET_SELECT_SIGNCMD_ID);
        expackMenu.addMenuItem(ET_CMDID);

    }
    setupMenu();
});
