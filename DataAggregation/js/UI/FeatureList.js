///////////////////////////////////////////////////////////////////////////
// Copyright © 2014 - 2016 Esri. All Rights Reserved.
//
// Licensed under the Apache License Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
///////////////////////////////////////////////////////////////////////////

define(['dojo/_base/declare',
  'dojo/_base/lang',
  'dojo/_base/array',
  'dojo/dom-construct',
  'dojo/dom-class',
  'dijit/_WidgetBase',
  "dijit/_TemplatedMixin",
  "dijit/_WidgetsInTemplateMixin",
  "dojo/Evented",
  "dojo/text!./templates/FeatureList.html",
  'dojo/query',
  'dojo/Deferred',
  'dojo/on',
  './Feature'
],
  function (declare,
    lang,
    array,
    domConstruct,
    domClass,
    _WidgetBase,
    _TemplatedMixin,
    _WidgetsInTemplateMixin,
    Evented,
    template,
    query,
    Deferred,
    on,
    Feature) {
    return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, Evented], {
      baseClass: 'cf-feature-list',
      declaredClass: 'CriticalFacilities.FeatureList',
      templateString: template,
      label: 'FeatureList',
      parent: null,
      nls: null,
      map: null,
      appConfig: null,
      config: null,
      features: [],
      updateFeatures: [],
      hint: "",
      theme: '',
      isDarkTheme: '',
      styleColor: '',
      type: '',
      isDuplicate: false,
      layer: null,
      _editToolbar: null,
      _syncFields: {},
      _started: false,

      //TODO may need a loading shelter here to avoid see feature views while adding

      constructor: function (options) {
        lang.mixin(this, options);
      },

      postCreate: function () {
        this.inherited(arguments);
        this.pageHint.innerHTML = this.hint;
        this._darkThemes = ['DartTheme', 'DashboardTheme'];
      },

      onShown: function () {
        this.pageContainer.nextDisabled = false;
        this.pageContainer.backDisabled = false;
      },

      startup: function () {
        this._started = true;
        this._updateAltIndexes();
        this._initFeatureList(this.features);
        this.updateImageNodes();

        this.own(on(this, 'feature-list-updated', lang.hitch(this, this._updateAltNextIndexes)));
        this.own(on(this.pageContainer, 'view-index-change', lang.hitch(this, this.test)));
      },

      test: function (v) {
        var rows = this.featureListTable.rows;
        if (rows && rows.length) {
          this._updateAltNextIndexes(this.featureListTable.rows.length);
        }
        if (v.oldIndex === this.altNextIndex) {
          this.altNextIndex = v.newIndex;
        }
      },

      validate: function (type, result) {
        var def = new Deferred();
        if (type === 'next-view') {
          def.resolve(this._nextView());
        } else if (type === 'back-view') {
          def.resolve(this._backView());
        } else {
          def.resolve(this._homeView(result));
        }
        return def;
      },

      _nextView: function () {
        var def = new Deferred();
        def.resolve(true);
        return def;
      },

      _backView: function () {
        var def = new Deferred();
        def.resolve(true);
        return def;
      },

      _homeView: function (backResult) {
        var def = new Deferred();
        var homeView = this.pageContainer.getViewByTitle('Home');
        homeView.verifyClearSettings(backResult).then(function (v) {
          def.resolve(v);
        });
        return def;
      },

      _updateAltIndexes: function () {
        //No gaurentee that page container will exist prior to when the view is created
        // However, it must exist for the page to be shown
        if (this.pageContainer && !this._reviewView) {
          this._reviewView = this.pageContainer.getViewByTitle('Review');
          if (this._reviewView) {
            this.altBackIndex = this._reviewView.index;
          }
        }
      },

      _updateAltNextIndexes: function (length) {
        if (length > 0) {
          var rows = this.featureListTable.rows;
          this.altNextIndex = rows[0].featureView.index;
          rows[rows.length - 1].featureView.altNextIndex = this.altNextIndex;
          this.finalFeatureIndex = rows[rows.length - 1].featureView.index;
          rows[rows.length - 1].featureView.altNextIndex = this._reviewView.index;
        }
      },

      _initFeatureList: function (features) {
        var x = 0;
        if (this.featureListTable.rows.length !== this.features.length) {
          array.forEach(features, lang.hitch(this, function (f) {
            //construct the individual feature rows
            this._initRow(f, x, false);
            x += 1;
          }));
        }

        this.pageContainer.selectView(this.index); //test
      },

      updateImageNodes: function () {
        //toggle white/black images
        var isDark = this._darkThemes.indexOf(this.theme) > -1;
        var removeClass = isDark ? 'next-arrow-img' : 'next-arrow-img-white';
        var addClass = isDark ? 'next-arrow-img-white' : 'next-arrow-img';
        var imageNodes = query('.' + removeClass, this.domNode);
        array.forEach(imageNodes, function (node) {
          domClass.remove(node, removeClass);
          domClass.add(node, addClass);
        });
      },

      setStyleColor: function (styleColor) {
        this.styleColor = styleColor;
      },

      updateTheme: function (theme) {
        this.theme = theme;
      },

      //TODO need to ensure label is unique
      _initFeatureView: function (feature, label, byIndex) {
        var feat = new Feature({
          nls: this.nls,
          map: this.map,
          parent: this.parent,
          config: this.config,
          appConfig: this.appConfig,
          label: label,
          altBackIndex: this.index,
          isDuplicate: this.isDuplicate,
          feature: feature,
          theme: this.theme,
          isDarkTheme: this.isDarkTheme,
          layer: this.layer,
          _editToolbar: this._editToolbar,
          csvStore: this.csvStore,
          _parentFeatureList: this
        });
        if (byIndex) {
          for (var i = 0; i < this.features.length; i++) {

          }

          this.pageContainer.addViewAtIndex(feat, this.finalFeatureIndex);
        } else {
          this.pageContainer.addView(feat);
        }

        if (typeof (this.altNextIndex) === 'undefined') {
          this.altNextIndex = feat.index;
        }
        this.finalFeatureIndex = feat.index;
        return this.pageContainer.getViewByTitle(label);
      },

      _initRow: function (f, x, byIndex) {
        var tr = domConstruct.create('tr', {
          className: "bottom-border feature-list-row",
          onclick: lang.hitch(this, function (evt) {
            console.log(evt.currentTarget.featureView);
            this.pageContainer.selectView(evt.currentTarget.featureView.index); //test
          })
        }, this.featureListTable);

        tr.featureView = this._initFeatureView(f, this.label + "_" + x, byIndex);
        tr.fieldInfo = f.fieldInfo;

        for (var i = 0; i < f.fieldInfo.length; i++) {
          var fi = f.fieldInfo[i];
          if (fi.name === this.layer.objectIdField) {
            tr._featureOID = fi.value;
            break;
          }
        }

        var tdLabel = domConstruct.create('td', {
          className: "pad-10"
        }, tr);
        domConstruct.create('div', {
          className: "main-text float-left text-left",
          innerHTML: f.label
        }, tdLabel);

        var tdArrow = domConstruct.create('td', {
          className: "width-15"
        }, tr);

        domConstruct.create('div', {
          className: "next-arrow float-right next-arrow-img"
        }, tdArrow);
      },

      removeFeature: function (feature, oid) {
        var def = new Deferred();
        var rows = this.featureListTable.rows;
        for (var i = 0; i < rows.length; i++) {
          var tr = rows[i];

          if (tr._featureOID === oid) {
            this.featureListTable.deleteRow(i);
            var featureIndex = this.features.indexOf(feature);
            if (featureIndex > -1) {
              this.features.splice(featureIndex, 1);
            }
            this.emit('feature-list-updated', this.features.length);
            if (i === this.features.length) {
              this.pageContainer.selectView(this.altBackIndex);
            }
            break;
          }
        }
        def.resolve('feature-removed');
        return def;
      },

      resetFeatureList: function () {
        if (this.featureListTable.rows.length > 0) {
          for (var i = this.featureListTable.rows.length; i > 0; i--) {
            this.pageContainer.removeView(this.featureListTable.rows[i - 1].featureView);
            this.featureListTable.deleteRow(i - 1);

          }
          this.altNextIndex = undefined;
          this._updateAltIndexes();
          this._initFeatureList(this.features);
          this.updateImageNodes();
        }
      },

      addFeature: function (feature) {
        this.features.push(feature);
      }
    });
  });