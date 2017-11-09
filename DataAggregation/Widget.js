define([
  'dojo/_base/declare',
  'dojo/_base/lang',
  'dojo/_base/array',
  'jimu/BaseWidget',
  "dojo/_base/xhr",
  //'jimu/LayerStructure',
  //'jimu/LayerNode',
  'jimu/LayerInfos/LayerInfos',
  './js/UI/PageContainer',
  './js/UI/Home',
  './js/UI/StartPage',
  './js/UI/LocationType'],
  function (declare,
    lang,
    array,
    BaseWidget,
    xhr,
    //LayerStructure,
    //LayerNode,
    LayerInfos,
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

      //TODO still need to handle single search
      //TODO need to ask WAB for a better approach for knowing the style color

      postCreate: function () {
        this.inherited(arguments);
        this.nls = lang.mixin(this.nls, window.jimuNls.common);
        this._setThemeAndColors();
        this._initConfigInfo();
      },

      startup: function () {

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
                  isRecognizedValues: field.isRecognizedValues
                });
              }
            }));

            //TODO will have to go through this an make it work with multiple lookup sources
            //only process on the first source for now
            if (this._geocodeSources) {
              var source = this._geocodeSources[0];

              var singleAddressField = source.singleAddressFields[0];
              this._singleFields = [{
                label: singleAddressField.label,
                value: singleAddressField.fieldName,
                type: singleAddressField.type,
                isRecognizedValues: singleAddressField.isRecognizedValues
              }];

              this._multiFields = [];
              array.forEach(source.addressFields, lang.hitch(this, function (field) {
                if (field && field.visible) {
                  this._multiFields.push({
                    label: field.label,
                    value: field.fieldName,
                    type: field.type,
                    isRecognizedValues: field.isRecognizedValues
                  });
                }
              }));
            }

            //Move to layer structure when we go to WAB core repo
            //this.layerStructure = LayerStructure.getInstance();
            //this.editLayerNode = this.layerStructure.getNodeById(this._configLayerInfo.featureLayer.id);
            //this.editLayer = this.editLayerNode.getLayerObject();

            LayerInfos.getInstance(this.map, this.map.itemInfo).then(lang.hitch(this, function (operLayerInfos) {
              this.opLayers = operLayerInfos;
              this.editLayer = operLayerInfos.getLayerInfoById(this._configLayerInfo.featureLayer.id).layerObject;
            }));
          }
        }
      },

      _initPageContainer: function () {
        //get base views that are not dependant on the user data
        var homeView = this._initHomeView();
        var startPageView = this._initStartPageView();
        var locationTypeView = this._initLocationTypeView();

        this._pageContainer = new PageContainer({
          views: [homeView, startPageView, locationTypeView],
          nls: this.nls,
          altHomeIndex: 1,
          appConfig: this.appConfig,
          displayControllerOnStart: false,
          parent: this,
          styleColor: this.styleColor
        }, this.pageNavigation);

        this._pageContainer.startup();
      },

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
      }
    });
  });