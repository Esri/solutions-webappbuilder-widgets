/*global define */
/** @license
| Copyright 2013 Esri
|
| Licensed under the Apache License, Version 2.0 (the "License");
| you may not use this file except in compliance with the License.
| You may obtain a copy of the License at
|
|    http://www.apache.org/licenses/LICENSE-2.0
|
| Unless required by applicable law or agreed to in writing, software
| distributed under the License is distributed on an "AS IS" BASIS,
| WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
| See the License for the specific language governing permissions and
| limitations under the License.
*/
//============================================================================================================================//
define([
  "dojo/_base/declare",
  "dojo/dom-construct",
  "dojo/dom-class",
  "dojo/dom-attr",
  "dojo/string",
  'jimu/dijit/ImageChooser',
  "dojo/text!./othersSetting.html",
  "dijit/_WidgetBase",
  "dijit/_TemplatedMixin",
  "dijit/_WidgetsInTemplateMixin"
], function (
  declare,
  domConstruct,
  domClass,
  domAttr,
  string,
  ImageChooser,
  othersSetting,
  _WidgetBase,
  _TemplatedMixin,
  _WidgetsInTemplateMixin
) {
  return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {
    templateString: othersSetting,
    ImageChooser: null,

    startup: function () {
      this.inherited(arguments);
    },

    postCreate: function () {
      this._createOthersPanel();
    },

    /**
    * This function used to call _createOthersDataPanel which sets the other panel values
    * @memberOf widgets/isolation-trace/settings/othersSetting
    */
    _createOthersPanel: function () {
      var baseURL;
      this.imageChooser = new ImageChooser({
        displayImg: this.showImageChooser,
        goldenWidth: 84,
        goldenHeight: 67
      });
      domClass.add(this.imageChooser.domNode, 'img-chooser');
      domConstruct.place(this.imageChooser.domNode, this.imageChooserBase);
      if (this.othersConfig && this.othersConfig.imageData) {
        if (this.othersConfig.imageData.indexOf("${appPath}") > -1) {
          baseURL = this.folderUrl.slice(0, this.folderUrl.lastIndexOf(
            "widgets"));
          domAttr.set(this.showImageChooser, 'src', string.substitute(
            this.othersConfig.imageData, {
              appPath: baseURL
            }));
        } else {
          domAttr.set(this.showImageChooser, 'src', this.othersConfig
            .imageData);
        }
      } else {
        this.thumbnailUrl = this.folderUrl +
          "/images/ani/default.gif";
        domAttr.set(this.showImageChooser, 'src', this.thumbnailUrl);
      }
      this._createOthersDataPanel();
    },

    /**
    * This function returns the highlighter image details for configuration.
    * @memberOf widgets/isolation-trace/settings/othersSetting
    */
    getOthersForm: function () {
      var othersParam;
      this.imageDataObj = "";
      if (this.imageChooser && this.imageChooser.imageData) {
        this.imageDataObj = this.imageChooser.imageData;
      } else if (this.othersConfig && this.othersConfig.imageData) {
        this.imageDataObj = this.othersConfig.imageData;
      } else if (this.thumbnailUrl) {
        this.imageDataObj = this.thumbnailUrl;
      }
      othersParam = {
        "highlighterDetails": {
          "imageData": this.imageDataObj,
          "height": ((this.spinnerImgHeight && this.spinnerImgHeight
            .value) ? this.spinnerImgHeight.value : ""),
          "width": ((this.spinnerImgWidth && this.spinnerImgWidth.value) ?
            this.spinnerImgWidth.value : ""),
          "timeout": ((this.spinnerImgTimeout && this.spinnerImgTimeout
            .value) ? this.spinnerImgTimeout.value : "")
        },
        "displayTextForRunButton": ((this.displayTextforRun && this
            .displayTextforRun.value) ? this.displayTextforRun.value :
          ""),
        "autoZoomAfterTrace": this.autoZoomAfterTrace.getValue()
      };
      return othersParam;
    },

    /**
    * This function is called to display others task details.
    * @memberOf widgets/isolation-trace/settings/othersSetting
    */
    _createOthersDataPanel: function () {
      if (this.othersConfig) {
        this.spinnerImgHeight.set("value", this.othersConfig.height);
        this.spinnerImgWidth.set("value", this.othersConfig.width);
        this.spinnerImgTimeout.set("value", this.othersConfig.timeout);
        this.displayTextforRun.set("value", this.displayTextForRunButton);
        if (this.autoZoomAfterTraceCheckedState) {
          //this.autoZoomAfterTrace.checked = this.autoZoomAfterTraceCheckedState;
          //domClass.add(this.autoZoomAfterTrace.checkNode, "checked");
          this.autoZoomAfterTrace.setValue(true);
        } else {
          this.autoZoomAfterTrace.setValue(false);
          //this.autoZoomAfterTrace.checked = this.autoZoomAfterTraceCheckedState;
          //domClass.remove(this.autoZoomAfterTrace.checkNode, "checked");
        }
      }
    }
  });
});