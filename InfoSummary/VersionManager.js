define(['jimu/shared/BaseVersionManager'],
function (BaseVersionManager) {

  function VersionManager() {
    this.versions = [{
      version: '1.3',
      upgrader: function (oldConfig) {
        return oldConfig;
      }
    }, {
      version: '1.4',
      upgrader: function (oldConfig) {
        return oldConfig;
      }
    }, {
      version: '2.0Beta',
      upgrader: function (oldConfig) {
        return oldConfig;
      }
    }, {
      version: '2.0',
      upgrader: function (oldConfig) {
        return oldConfig;
      }
    }, {
      version: '2.0.1',
      upgrader: function (oldConfig) {
        return oldConfig;
      }
    }, {
      version: '2.1',
      upgrader: function (oldConfig) {
        oldConfig.countEnabled = true;

        var tc;
        var tc2;

        var mainPanelIcon = oldConfig.mainPanelIcon.toString();
        mainPanelIcon = mainPanelIcon.replace('><img', '');
        mainPanelIcon = mainPanelIcon.replace('src=\"', 'style=\"background-image:url(');
        mainPanelIcon = mainPanelIcon.replace('\" title=\"', ');\" title=\"');
        oldConfig.mainPanelIcon = mainPanelIcon;
        var lyrInfos = oldConfig.layerInfos;
        if (lyrInfos) {
          for (var i = 0; i < lyrInfos.length; i++) {
            var oldM;
            var newM;
            var li = lyrInfos[i];
            if (li.imageData) {
              var imageData = '<div class=\"imageDataGFX\">' + li.imageData + '</div>';
              imageData = imageData.replace('width=\"18\" height=\"18\"', 'width=\"28\" height=\"28\"');
              imageData = imageData.replace('width=\"18\" height=\"18\"', 'width=\"28\" height=\"28\"');
              imageData = imageData.replace('x=\"-9\" y=\"-9\"', 'x=\"-14\" y=\"-14\"');
              oldM = 'matrix(1.00000000,0.00000000,0.00000000,1.00000000,9.00000000,9.00000000)';
              newM = 'matrix(1.00000000,0.00000000,0.00000000,1.00000000,14.00000000,14.00000000)';
              li.imageData = imageData.replace(oldM, newM);
            }
            if (li.panelImageData) {
              var panelImageData = li.panelImageData;
              if (panelImageData.indexOf('<img') > -1) {
                panelImageData = panelImageData.replace('class=\"', 'style=\"width:44px; height:44px;\" class=\"');
              } else {
                panelImageData = panelImageData.replace('width=\"35\" height=\"35\"', 'width=\"44\" height=\"44\"');
                panelImageData = panelImageData.replace('width=\"35\" height=\"35\"', 'width=\"44\" height=\"44\"');
                panelImageData = panelImageData.replace('x=\"-18\" y=\"-18\"', 'x=\"-22\" y=\"-22\"');
                oldM = 'matrix(1.00000000,0.00000000,0.00000000,1.00000000,17.50000000,17.50000000)';
                newM = 'matrix(1.00000000,0.00000000,0.00000000,1.00000000,22.00000000,22.00000000)';
                panelImageData = panelImageData.replace(oldM, newM);
              }
              li.panelImageData = panelImageData;
            }
            if (li.symbolData) {
              var symbolData = li.symbolData;
              symbolData.displayFeatureCount = false;
              symbolData._highLightColor = '#ffffff';
              symbolData.featureDisplayOptions = {
                groupEnabled: false,
                fields: [],
                groupField: { name: "", label: "" }
              };

              if (symbolData.clusterType !== 'ThemeCluster') {
                tc = symbolData.clusterSymbol;
                tc2 = symbolData.clusterType;
              }

              if (symbolData.clusterType === 'ThemeCluster') {
                if (tc) {
                  symbolData.clusterType = tc2;
                  symbolData.clusterSymbol = tc;
                } else {
                  //symbolData.clusterType = 'CustomCluster';
                  symbolData.clusterSymbol = {
                    color: [155, 187, 89, 128],
                    outline: {
                      color: [115, 140, 61, 255],
                      width: 1.5,
                      type: "esriSLS",
                      style: "esriSLSSolid"
                    },
                    type: "esriSFS",
                    style: "esriSFSSolid"
                  };
                }
              }

              if (symbolData.s) {
                var panelHTML = symbolData.s;
                if (panelHTML.indexOf('width=\"26\" height=\"26\"') > -1) {
                  panelHTML = panelHTML.replace('width=\"26\" height=\"26\"', 'width=\"44\" height=\"44\"');
                  panelHTML = panelHTML.replace('width=\"26\" height=\"26\"', 'width=\"44\" height=\"44\"');
                  panelHTML = panelHTML.replace('x=\"-13\" y=\"-13\"', 'x=\"-22\" y=\"-22\"');
                  oldM = 'matrix(1.00000000,0.00000000,0.00000000,1.00000000,13.00000000,13.00000000)';
                  newM = 'matrix(1.00000000,0.00000000,0.00000000,1.00000000,22.00000000,22.00000000)';
                  panelHTML = panelHTML.replace(oldM, newM);
                  panelHTML = panelHTML.replace(oldM, newM);
                } else if (panelHTML.indexOf('data:image' > -1)) {
                  var svg = '<svg overflow=\"hidden\" width=\"44\" height=\"44\"><defs></defs>';
                  svg += '<image fill-opacity=\"0\" stroke=\"none\" ';
                  svg += 'stroke-opacity=\"0\" stroke-width=\"1\" stroke-linecap=\"butt\" ';
                  svg += 'stroke-linejoin=\"miter\" stroke-miterlimit=\"4\" ';
                  svg += 'x=\"-22\" y=\"-22\" width=\"44\" height=\"44\"';
                  svg += 'preserveAspectRatio=\"none\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" ';
                  svg += 'xlink:href=\"';
                  svg += panelHTML;
                  svg += '\" transform=\"';
                  svg += 'matrix(1.00000000,0.00000000,0.00000000,1.00000000,22.00000000,22.00000000)\">';
                  svg += '</image></svg>';
                }
                symbolData.panelHTML = panelHTML;
              }
              li.symbolData = symbolData;
            }
            lyrInfos[i] = li;
          }
        }
        return oldConfig;
      }
    }, {
      version: '2.2',
      upgrader: function (oldConfig) {
        return oldConfig;
      }
    }, {
      version: '2.3',
      upgrader: function (oldConfig) {
        return oldConfig;
      }
    }, {
      version: '2.4',
      upgrader: function (oldConfig) {
        return oldConfig;
      }
    },{
      version: '2.5',
      upgrader: function (oldConfig) {
        var newConfig = oldConfig;
        newConfig.upgradeFields = true;
        return newConfig;
      }
    }];
  }

  VersionManager.prototype = new BaseVersionManager();
  VersionManager.prototype.constructor = VersionManager;
  return VersionManager;
});