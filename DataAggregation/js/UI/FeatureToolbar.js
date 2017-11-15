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
  'dojo/Evented',
  'dojo/query',
  'dojo/dom-class',
  'dojo/dom-construct',
  'dojo/Deferred',
  'dijit/_WidgetBase',
  'dijit/_TemplatedMixin',
  'dojo/on',
  'dojo/text!./templates/FeatureToolbar.html',
  'esri/toolbars/edit',
  'jimu/dijit/Popup'
],
  function (declare,
    lang,
    array,
    Evented,
    query,
    domClass,
    domConstruct,
    Deferred,
    _WidgetBase,
    _TemplatedMixin,
    on,
    template,
    Edit,
    Popup) {
    return declare([_WidgetBase, _TemplatedMixin, Evented], {
      templateString: template,

      'baseClass': 'cf-feature-toolbar',
      declaredClass: 'FeatureToolbar',
      label: "FeatureToolbar",

      parent: null,
      nls: null,
      map: null,
      appConfig: null,
      config: null,
      feature: null,
      layer: null,
      theme: '',
      isDarkTheme: '',
      locators: [],
      styleColor: '',
      featureView: null,
      _editToolbar: null,

      //TODO add message on save when is duplicate...at this point ask them if they would like to keep both or overwrite

      constructor: function (options) {
        lang.mixin(this, options);

        //enable editing when pencil is clicked
        this._editDisabled = true;

        //enable save when change to geometry or attributes
        this._saveDisabled = true;

        //enable locate when change to address
        this._locateDisabled = true;

        //Used to store and listen when a change occurs
        this._hasAttributeEdit = false;
        this.own(on(this.featureView, 'attribute-change', lang.hitch(this, function (v) {
          this._hasAttributeEdit = v;
          if (this.featureView.isDuplicate && this.featureView._useGeomFromLayer) {
            this._updateSave(!(this._hasAttributeEdit));
          } else {
            this._updateSave(!(this._hasAttributeEdit || this._hasGeometryEdit));
          }
        })));

        this._hasAddressEdit = false;
        this.own(on(this.featureView, 'address-change', lang.hitch(this, function (v) {
          this._hasAddressEdit = v;
          this._updateLocate(!v);
        })));

        this._hasGeometryEdit = false;
        this.own(on(this._editToolbar, 'graphic-move-stop', lang.hitch(this, function (v) {
          console.log(v);
          this._hasGeometryEdit = true;
          if (this.featureView.isDuplicate && this.featureView._useGeomFromLayer) {
            this._updateSave(!(this._hasAttributeEdit));
          } else {
            this._updateSave(!(this._hasAttributeEdit || this._hasGeometryEdit));
          }
        })));
      },

      postCreate: function () {
        this.inherited(arguments);
        this._darkThemes = ['DartTheme', 'DashboardTheme'];
        this.updateImageNodes();
      },

      startup: function () {
        this.inherited(arguments);
        this._started = true;
        this.featureView._toggleEditControls(this._editDisabled);
      },

      _edit: function () {
        this._editDisabled = !this._editDisabled;
        this._updateEdit(this._editDisabled);

        this.featureView._toggleEditControls(this._editDisabled);

        if (this.map.infoWindow.isShowing) {
          this.map.infoWindow.hide();
        }

        if (!this._editDisabled) {
          this._editToolbar.activate(Edit.MOVE, this.featureView._feature);
          this.map.infoWindow.setFeatures(this.featureView._feature);
          this.map.infoWindow.select(0);
          //this.map.infoWindow.show(this.featureView._feature.geometry);
        } else {
          this._editToolbar.refresh();
          this._editToolbar.deactivate();
        }
      },

      _locate: function () {
        //locate feature
        this._locateFeature();

        //disable locate
        this._updateLocate(true);
      },

      _save: function () {
        var values = this.featureView._getEditValues();
        if (this.featureView.isDuplicate) {
          this._showDuplicateSavePopup().then(lang.hitch(this, function (results) {
            if (results.save) {
              switch (results.type) {
                case 'overwrite':
                  array.forEach(Object.keys(values), lang.hitch(this, function (k) {
                    this.featureView._editFeature.attributes[k] = values[k];
                  }));
                  this.parent.editLayer.applyEdits(null, [this.featureView._editFeature], null);
                  break;
                case 'both':
                  array.forEach(Object.keys(values), lang.hitch(this, function (k) {
                    this.featureView._feature.attributes[k] = values[k];
                  }));
                  var updateFeature = lang.clone(this.featureView._feature);
                  array.forEach(this.featureView._skipFields, lang.hitch(this, function (sf) {
                    if (sf !== this.layer.objectIdField) {
                      delete updateFeature.attributes[sf];
                    }
                  }));
                  this.parent.editLayer.applyEdits([updateFeature], null, null);
                  break;
              }

              //disable save
              this._updateSave(true);
              this._updateEdit(true);
            }
          }));
        } else {
          array.forEach(Object.keys(values), lang.hitch(this, function (k) {
            this.featureView._feature.attributes[k] = values[k];
          }));

          var updateFeature = this.featureView._feature;
          if (this.featureView.label.indexOf('UnMatched') === -1) {
            this.layer.applyEdits(null, [updateFeature], null);
          } else {
            array.forEach(this.featureView._skipFields, lang.hitch(this, function (sf) {
              delete updateFeature.attributes[sf];
            }));
            this.parent.editLayer.applyEdits([updateFeature], null, null);
            this.parent._pageContainer.removeViewByTitle(this.featureView.label);
          }

          //disable save
          this._updateSave(true);
          this._updateEdit(true);
        }
      },

      locateFeature: function () {
        //return feature from locationToAddress
      },

      setStyleColor: function (styleColor) {
        this.styleColor = styleColor;
      },

      _updateEdit: function (disabled) {
        this._editDisabled = disabled;
        this._updateImageNode('bg-edit', 'bg-edit-white', 'bg-edit-disabled', this._editDisabled);
      },

      _updateSave: function (disabled) {
        this._saveDisabled = disabled;
        this._updateImageNode('bg-save', 'bg-save-white', 'bg-save-disabled', this._saveDisabled);
      },

      _updateLocate: function (disabled) {
        this._locateDisabled = disabled;
        this._updateImageNode('bg-locate', 'bg-locate-white', 'bg-locate-disabled', this._locateDisabled);
      },

      updateImageNodes: function () {
        //toggle all images
        this._updateImageNode('bg-edit', 'bg-edit-white', 'bg-edit-disabled', this._editDisabled);
        this._updateImageNode('bg-save', 'bg-save-white', 'bg-save-disabled', this._saveDisabled);
        this._updateImageNode('bg-locate', 'bg-locate-white', 'bg-locate-disabled', this._locateDisabled);
      },

      _updateImageNode: function (img, imgWhite, imgDisabled, isDisabled) {
        var isDark = this._darkThemes.indexOf(this.theme) > -1;
        var addClass = isDisabled ? imgDisabled : isDark ? imgWhite : img;

        //var removeClass = isDark ? img : imgWhite;
        var removeClass = imgWhite;
        var nodesFound = false;
        var imageNodes = query('.' + img, this.domNode);
        if (imageNodes.hasOwnProperty('length') && imageNodes.length === 0) {
          imageNodes = query('.' + imgDisabled, this.domNode);
        } else {
          nodesFound = true;
          removeClass = img;
        }

        if (!nodesFound && imageNodes.hasOwnProperty('length') && imageNodes.length === 0) {
          imageNodes = query('.' + imgWhite, this.domNode);
        } else {
          if (!nodesFound) {
            nodesFound = true;
            removeClass = imgDisabled;
          }
        }
        array.forEach(imageNodes, function (node) {
          domClass.remove(node, removeClass);
          domClass.add(node, addClass);
        });
      },

      updateTheme: function (theme) {
        this.theme = theme;
      },

      _showDuplicateSavePopup: function () {
        var def = new Deferred();
        var content = domConstruct.create('div');

        domConstruct.create('div', {
          innerHTML: 'Would you like to override the existing feature?'
        }, content);

        if (this.featureView._useGeomFromFile || this.featureView._useValuesFromFile) {
          //if using values or geom from file see if they want to overwrite or store both
          var savePopup = new Popup({
            titleLabel: "Overwrite Feature",
            width: 400,
            autoHeight: true,
            content: content,
            buttons: [{
              label: this.nls.yes,
              onClick: lang.hitch(this, function () {
                savePopup.close();
                savePopup = null;
                def.resolve({ save: true, type: 'overwrite' });
              })
            }, {
              label: this.nls.no,
              onClick: lang.hitch(this, function () {
                savePopup.close();
                savePopup = null;
                def.resolve({ save: true, type: 'both' });
              })
            }, {
              label: this.nls.cancel,
              classNames: ['jimu-btn-vacation'],
              onClick: lang.hitch(this, function () {
                savePopup.close();
                savePopup = null;
                def.resolve({ save: false, type: undefined });
              })
            }],
            onClose: function () {
              savePopup = null;
            }
          });
        } else {
          def.resolve({ save: true, type: 'overwrite' });
        }
        return def;
      }
    });
  });