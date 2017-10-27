define([
  'dojo/_base/declare',
  'jimu/BaseWidget',
  './js/UI/PageContainer',
  'dojo/on',
  'dojo/_base/lang',
  'jimu/dijit/TabContainer3',
  './js/UI/Home',
  './js/UI/Addresses',
  './js/UI/Coordinates',
  './js/UI/StartPage',
  './js/UI/LocationType',
  './js/UI/Coordinates',
  './js/UI/FieldMapping',
  './js/UI/Review',
  './js/UI/FeatureList',
  './js/UI/Feature'],
  function (declare,
    BaseWidget,
    PageContainer,
    on,
    lang,
    TabContainer3,
    Home,
    Addresses,
    Coordinates,
    StartPage,
    LocationType,
    Coordinates,
    FieldMapping,
    Review,
    FeatureList,
    Feature) {
    return declare([BaseWidget], {
      baseClass: 'jimu-widget-critical-facilities-ui',

      postCreate: function () {
        this.inherited(arguments);
        this._setThemeAndColors(this.appConfig.theme.name);
        this._initPageContainer();
      },

      _setThemeAndColors: function (theme) {
        this.theme = theme;
      },

      _initPageContainer: function () {
        var h = new Home({
          nls: this.nls,
          map: this.map,
          parent: this,
          config: this.config,
          appConfig: this.appConfig,
          theme: this.theme,
          isDarkTheme: this.isDarkTheme
        });

        var sp = new StartPage({
          nls: this.nls,
          map: this.map,
          parent: this,
          config: this.config,
          appConfig: this.appConfig,
          theme: this.theme,
          isDarkTheme: this.isDarkTheme
        });

        var lt = new LocationType({
          nls: this.nls,
          map: this.map,
          parent: this,
          config: this.config,
          appConfig: this.appConfig,
          theme: this.theme,
          isDarkTheme: this.isDarkTheme
        });

        var c = new Coordinates({
          nls: this.nls,
          map: this.map,
          parent: this,
          config: this.config,
          appConfig: this.appConfig,
          fields: [{
            label: "Lat",
            value: "Lat",
            xSelected: true
          }, {
              label: "Lon",
              value: "Lon",
              ySelected: true
            }],
          xLabel: "Latitude",
          yLabel: "Longitude",
          theme: this.theme,
          isDarkTheme: this.isDarkTheme
        });

        //TODO need to make a structure that will allow us to handle
        // the user defined is-recognized values and the type based recognition
        var add = new Addresses({
          nls: this.nls,
          map: this.map,
          parent: this,
          config: this.config,
          appConfig: this.appConfig,
          singleFields: [{
            label: "Address",
            isRecognizedValues: ['Address']
          }],
          multiFields: [{
            label: "City",
            isRecognizedValues: ['City'],
          }, {
            label: "State",
            isRecognizedValues: ['State']
            }],
          fields: [{
            label: "City",
            value: "City",
            type: "string"
          }, {
            label: "State",
            value: "State",
            type: "string"
            }],
          theme: this.theme,
          isDarkTheme: this.isDarkTheme
        });

        var f = new FieldMapping({
          nls: this.nls,
          map: this.map,
          parent: this,
          config: this.config,
          appConfig: this.appConfig,
          targetFields: [{
            label: "Address",
            isRecognizedValues: ['Address']
          }, {
            label: "Address1",
            isRecognizedValues: ['Address1']
            }, {
              label: "Address2",
              isRecognizedValues: ['Address2']
          }, {
            label: "Address3",
            isRecognizedValues: ['Address3']
            }, {
              label: "Address4",
              isRecognizedValues: ['Address4']
            }],
          sourceFields: [{
            label: "City",
            value: "City",
            type: "string"
          }, {
            label: "State",
            value: "State",
            type: "string"
            }],
          theme: this.theme,
          isDarkTheme: this.isDarkTheme
        });

        var r = new Review({
          nls: this.nls,
          map: this.map,
          parent: this,
          config: this.config,
          appConfig: this.appConfig,
          matchedList: [1,2,3,4], //array of FeatureItems
          unMatchedList: [1, 2, 3, 4], //array of FeatureItems
          duplicateList: [1, 2], //array of FeatureItems
          theme: this.theme,
          isDarkTheme: this.isDarkTheme
        });

        var fl = new FeatureList({
          nls: this.nls,
          map: this.map,
          parent: this,
          config: this.config,
          appConfig: this.appConfig,
          hint: this.nls.review.reviewMatchedPageHint,
          features: [{
            label: 'Bel Air Elemmentary 1',
            fieldInfo: [{
              name: 'Factility Name',
              value: 'Bel Air Elemmentary'
            }, {
              name: 'Managed By',
              value: 'Some Dude'
            }, {
              name: 'Address',
              value: '380 New York St'
            }, {
              name: 'City',
              value: 'Redlands'
            }]
          }, {
            label: 'Bel Air Elemmentary 2',
            fieldInfo: [{
              name: 'Factility Name',
              value: 'Bel Air Elemmentary'
            }, {
              name: 'Managed By',
              value: 'Some Dude'
            }, {
              name: 'Address',
              value: '380 New York St'
            }, {
              name: 'City',
              value: 'Redlands'
            }]
            }, {
              label: 'Bel Air Elemmentary 3',
              fieldInfo: [{
                name: 'Factility Name',
                value: 'Bel Air Elemmentary'
              }, {
                name: 'Managed By',
                value: 'Some Dude'
              }, {
                name: 'Address',
                value: '380 New York St'
              }, {
                name: 'City',
                value: 'Redlands'
              }]
          }],
          theme: this.theme,
          isDarkTheme: this.isDarkTheme
        });

        var feat = new Feature({
          nls: this.nls,
          map: this.map,
          parent: this,
          config: this.config,
          appConfig: this.appConfig,
          feature: {
            label: 'Bel Air Elemmentary 1',
            fieldInfo: [{
              name: 'Factility Name',
              value: 'Bel Air Elemmentary'
            }, {
              name: 'Managed By',
              value: 'Some Dude'
            }, {
              name: 'Address',
              value: '380 New York St'
            }, {
              name: 'City',
              value: 'Redlands'
            }]
          },
          theme: this.theme,
          isDarkTheme: this.isDarkTheme
        });

        var duplicateFeat = new Feature({
          nls: this.nls,
          map: this.map,
          parent: this,
          config: this.config,
          appConfig: this.appConfig,
          isDuplicate: true,
          feature: {
            label: 'Bel Air Elemmentary 1',
            fieldInfo: [{
              name: 'Factility Name',
              value: 'Bel Air Elemmentary',
              duplicateFieldInfo: {
                value: 'Bel Air Elemmentary duplicate'
              }
            }, {
              name: 'Managed By',
              value: 'Some Dude',
              duplicateFieldInfo: {
                value: 'Some Dude duplicate'
              }
            }, {
              name: 'Address',
              value: '380 New York St',
              duplicateFieldInfo: {
                value: '380 New York St duplicate'
              }
            }, {
              name: 'City',
              value: 'Redlands',
              duplicateFieldInfo: {
                value: 'Redlands duplicate'
              }
            }]
          },
          theme: this.theme,
          isDarkTheme: this.isDarkTheme
        });

        //views: [h, sp, lt, c, add, f, r, fl, feat, duplicateFeat]

        this._pageContainer = new PageContainer({
          views: [h, sp, lt, c, add, f, r, fl, feat, duplicateFeat],
          nls: this.nls.pageContainer,
          appConfig: this.appConfig
        }, this.pageNavigation);

        this.own(on(this._pageContainer, 'tabChanged', lang.hitch(this, function (title) {
          console.log(title);
        })));

        this._pageContainer.startup();
      },

      updatePageContainer: function () {

      },

      onAppConfigChanged: function (appConfig, reason, changedData) {
        //switch (reason) {
        //  case 'themeChange':
        //    this._setThemeAndColors(changedData);
        //    this.destroy();
        //    break;
        //  case 'layoutChange':
        //    this.destroy();
        //    break;
        //  case 'styleChange':
        //    this._updateStyleColor(changedData);
        //    break;
        //  case 'widgetChange':
        //    this.widgetChange = true;
        //    this.destroy();
        //    break;
        //  case 'mapChange':
        //    //this._clearMap();
        //    this.destroy();
        //    break;
        //}
      },

      _updateStyleColor: function (changedData) {
        setTimeout(lang.hitch(this, function () {
          var p = this.getPanel();
          var node;
          switch (this.theme) {
            case 'BoxTheme':
              node = p.containerNode.parentNode.parentNode.children[0];
              break;
            case 'DartTheme':
              node = p.containerNode.parentNode;
              break;
            case 'TabTheme':
              node = p.containerNode;
              break;
            case 'BillboardTheme':
              node = p.containerNode.parentNode;
              break;
            case 'FoldableTheme':
              node = p.containerNode.parentNode.firstChild;
              break;
            default:
              node = this.pageHeader;
              break;
          }
          var bc = window.getComputedStyle(node, null).getPropertyValue('background-color');
          this._styleColor = Color.fromRgb(bc).toHex();
          array.forEach(this._pageContainer.views, function (view) {
            view.setStyleColor(this._styleColor);

            //need to test if should use lite or dark buttons

          });
        }), 50);
      },

      _updateStyleColor: function (changedData) {
        this.isLightTheme = changedData ? changedData === 'light' : this.isLightTheme;

        setTimeout(lang.hitch(this, function () {
          var p = this.getPanel();
          var node;
          switch (this.appConfig.theme.name) {
            default:
              node = this.pageHeader;
              break;
          }
          var bc = window.getComputedStyle(node, null).getPropertyValue('background-color');
          this.styleColor = bc ? Color.fromRgb(bc).toHex() : "#485566";
          array.forEach(this._pageContainer.views, function (view) {
            view.setStyleColor(this.styleColor);

            //need to test if should use lite or dark buttons

          });
        }), 50);
      },
    });
  });