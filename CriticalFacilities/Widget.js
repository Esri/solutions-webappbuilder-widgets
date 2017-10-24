define([
  'dojo/_base/declare',
  'jimu/BaseWidget',
  './js/UI/PageContainer',
  'dojo/on',
  'dojo/_base/lang',
  'jimu/dijit/TabContainer3',
  './pages/Home',
  './pages/Addresses',
  './pages/Coordinates',
  './pages/StartPage',
  './pages/LocationType',
  './pages/Coordinates'],
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
    Coordinates) {
    return declare([BaseWidget], {
      baseClass: 'jimu-widget-critical-facilities-ui',

      postCreate: function () {
        this.inherited(arguments);

        this._initPageContainer();
      },

      _initPageContainer: function () {
        var h = new Home({
          nls: this.nls,
          map: this.map,
          parent: this,
          config: this.config,
          appConfig: this.appConfig
        });

        var sp = new StartPage({
          nls: this.nls,
          map: this.map,
          parent: this,
          config: this.config,
          appConfig: this.appConfig
        });

        var lt = new LocationType({
          nls: this.nls,
          map: this.map,
          parent: this,
          config: this.config,
          appConfig: this.appConfig
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
          yLabel: "Longitude"
        });

        //TODO need to make a structure that will allow us to handle
        // the user defined is-recognized values 
        var add = new Addresses({
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
          }]
        });

        this._pageContainer = new PageContainer({
          views: [h, sp, lt, c, add]
        }, this.pageNavigation);

        this.own(on(this._pageContainer, 'tabChanged', lang.hitch(this, function (title) {
          console.log(title);
        })));

        this._pageContainer.startup();
      }
    });
  });