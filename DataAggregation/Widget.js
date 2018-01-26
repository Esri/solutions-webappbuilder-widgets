define([
  'dojo/_base/declare',
  'dojo/_base/lang',
  'dojo/_base/array',
  'jimu/BaseWidget',
  "dojo/_base/xhr",
  'jimu/LayerStructure',
  './js/UI/PageContainer',
  './js/UI/Home',
  './js/UI/StartPage',
  './js/UI/LocationType'],
  function (declare,
    lang,
    array,
    BaseWidget,
    xhr,
    LayerStructure,
    PageContainer,
    Home,
    StartPage,
    LocationType) {
    return declare([BaseWidget], {
      baseClass: 'jimu-widget-critical-facilities-ui',

      _configLayerInfo: null,
      _url: '',
      _geocodeSources: null,
      _fsFields: null,
      _singleFields: null,
      _multiFields: null,
      editLayer: null,
      _pageContainer: null,

      _locationMappingComplete: false,
      _fieldMappingComplete: false,
      _tempResultsAdded: false,

      postCreate: function () {
        this.inherited(arguments);
        this.nls = lang.mixin(this.nls, window.jimuNls.common);
        this._setThemeAndColors();
        this._initConfigInfo();
      },

      /*jshint unused:false*/
      onAppConfigChanged: function (appConfig, reason, changedData) {
        switch (reason) {
          case 'themeChange':
            break;
          case 'layoutChange':
            break;
          case 'styleChange':
            break;
          case 'widgetChange':
            this._clearResults();
            break;
          case 'mapChange':
            break;
        }
      },

      _setThemeAndColors: function () {
        this.theme = this.appConfig.theme.name;
        this.styleColor = this._getStyleColor();
      },

      _getStyleColor: function (styleName) {
        var s = this.appConfig.theme.styles[0];
        if (styleName) {
          s = styleName;
        }
        var url = "./themes/" + this.theme + "/manifest.json";
        xhr.get({
          url: url,
          handleAs: "json",
          load: lang.hitch(this, function (data) {
            var styles = data.styles;
            for (var i = 0; i < styles.length; i++) {
              var st = styles[i];
              if (st.name === s) {
                this.styleColor = st.styleColor;
                this._initPageContainer();
              }
            }
          })
        });
      },

      _initConfigInfo: function () {
        if (this.config.layerSettings && this.config.layerSettings.layerInfo) {
          this._valid = true;
          this._configLayerInfo = this.config.layerSettings.layerInfo;
          this._url = this._configLayerInfo.featureLayer.url;
          this._geocodeSources = this.config.sources;
          this._symbol = this.config.layerSettings.symbol;

          this._fsFields = [];
          if (this._configLayerInfo) {
            var ints = ["esriFieldTypeSmallInteger", "esriFieldTypeInteger", "esriFieldTypeSingle"];
            var dbls = ["esriFieldTypeDouble"];

            array.forEach(this._configLayerInfo.fieldInfos, lang.hitch(this, function (field) {
              if (field && field.visible) {
                this._fsFields.push({
                  name: field.fieldName,
                  label: field.label,
                  value: field.type,
                  type: ints.indexOf(field.type) > -1 ? "int" : dbls.indexOf(field.type) > -1 ? "float" : "other",
                  isRecognizedValues: field.isRecognizedValues,
                  duplicate: field.duplicate
                });
              }
            }));

            //TODO will have to go through this and make it work with multiple lookup sources
            //only process on the first source for now
            if (this._geocodeSources) {
              var source = this._geocodeSources[0];

              var singleAddressField = source.singleAddressFields[0];
              this._singleFields = [{
                label: singleAddressField.label || singleAddressField.alias,
                value: singleAddressField.fieldName || singleAddressField.name,
                type: "STRING",
                isRecognizedValues: singleAddressField.isRecognizedValues
              }];

              this._multiFields = [];
              array.forEach(source.addressFields, lang.hitch(this, function (field) {
                if ((field && field.visible) || typeof(field.visible) === 'undefined') {
                  this._multiFields.push({
                    label: field.label || field.alias,
                    value: field.fieldName || field.name,
                    type: "STRING",
                    isRecognizedValues: field.isRecognizedValues
                  });
                }
              }));
            }

            this.layerStructure = LayerStructure.getInstance();
            this.editLayerNode = this.layerStructure.getNodeById(this._configLayerInfo.featureLayer.id);
            this.editLayerNode.getLayerObject().then(lang.hitch(this, function (layer) {
              this.editLayer = layer;
            }));
          }
        }
      },

      _initPageContainer: function () {
        //get base views that are not dependant on the user data
        var homeView = this._initHomeView();
        var startPageView = this._initStartPageView();
        var locationTypeView = this._initLocationTypeView();

        if (this._pageContainer) {
          this._locationMappingComplete = false;
          this._fieldMappingComplete = false;
          this._tempResultsAdded = false;
          this._pageContainer._clearViews();
          this._pageContainer.views = [];
          this._pageContainer._currentIndex = -1;
          this._pageContainer._homeIndex = 0;
          this._pageContainer._rootIndex = 0;
          this._pageContainer.nextDisabled = false;
          this._pageContainer.backDisabled = true;
          this._pageContainer.selected = '';
          this._pageContainer.displayControllerOnStart = false;
          this._pageContainer.toggleController(true);
          this._pageContainer.updateImageNodes();
          this._pageContainer.views = [homeView, startPageView, locationTypeView];
          this._pageContainer.startup();
        } else {
          this._pageContainer = new PageContainer({
            views: [homeView, startPageView, locationTypeView],
            nls: this.nls,
            appConfig: this.appConfig,
            displayControllerOnStart: false,
            parent: this,
            styleColor: this.styleColor
          }, this.pageNavigation);

          this._pageContainer.startup();
        }
      },

      //_initPageContainer: function () {
      //  this._locationMappingComplete = false;
      //  this._fieldMappingComplete = false;
      //  this._tempResultsAdded = false;

      //  //get base views that are not dependant on the user data
      //  var homeView = this._initHomeView();
      //  var startPageView = this._initStartPageView();
      //  var locationTypeView = this._initLocationTypeView();

      //  var options = {
      //    views: [homeView, startPageView, locationTypeView],
      //    nls: this.nls,
      //    appConfig: this.appConfig,
      //    displayControllerOnStart: false,
      //    parent: this,
      //    styleColor: this.styleColor,
      //    backDisabled: true
      //  };

      //  if (this._pageContainer) {
      //    this._pageContainer.reset();
      //  } else {
      //    this._pageContainer = new PageContainer(options, this.pageNavigation);
      //  }
      //  this._pageContainer.startup();
      //},


      _initHomeView: function () {
        return new Home({
          nls: this.nls,
          map: this.map,
          parent: this,
          config: this.config,
          appConfig: this.appConfig,
          theme: this.theme,
          isDarkTheme: this.isDarkTheme,
          _geocodeSources: this._geocodeSources,
          _fsFields: this._fsFields,
          _singleFields: this._singleFields,
          _multiFields: this._multiFields,
          styleColor: this.styleColor
        });
      },

      _initStartPageView: function () {
        return new StartPage({
          nls: this.nls,
          map: this.map,
          parent: this,
          config: this.config,
          appConfig: this.appConfig,
          theme: this.theme,
          isDarkTheme: this.isDarkTheme,
          styleColor: this.styleColor
        });
      },

      _initLocationTypeView: function () {
        return new LocationType({
          nls: this.nls,
          map: this.map,
          parent: this,
          config: this.config,
          appConfig: this.appConfig,
          theme: this.theme,
          isDarkTheme: this.isDarkTheme,
          styleColor: this.styleColor
        });
      },

      _clearResults: function () {
        if (this._pageContainer) {
          var homeView = this._pageContainer.getViewByTitle('Home');
          if (homeView) {
            homeView._clearStore();
            homeView._clearMapping();
          }
        }
      }
    });
  });