/*global define */
///////////////////////////////////////////////////////////////////////////
// Copyright © 2014 Esri. All Rights Reserved.
//
// Licensed under the Apache License Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
///////////////////////////////////////////////////////////////////////////
define({
  root: {
    lblBusinessesLayer: "Selection layer",
    lblAccessPointLayers: "Access point layers",
    lblForRouteLengthUnits: "Route result unit label",
    lblForRouteRoundingOption: "Rounding option",
    lblForExpression: "Route result expression",
    lblFieldTobeDisplayed: "Field to be displayed in result list",
    captionServiceAreaParameters: "Selection layer settings",
    lblBufferDistanceToGenerateServiceArea: "Buffer distance to generate service area",
    lblBufferUnits: "Buffer units",
    lblLengthUnits: "Route length conversion units",
    captionClosestFacilityParameters: "Closest facility parameters",
    lblClosestFacilityServiceUrl: "Closest facility service URL",
    btnSet: "Set",
    btnRefresh: "Refresh",
    lblFacilitySearchDistance: "Facility search distance",
    lblImpedanceAttribute: "Impedance attribute",
    lblDefaultCutOffDistance: "Default cut off distance",
    captiveAttributeLookup: "Attribute lookup",
    lblAttributeParamLookup: "Attribute parameter value lookup",
    captionSaveResults: "Target layers to save results to layer",
    lblRouteLayer: "Route layer",
    lblRouteLength: "Field to save route length",
    lblBusinessCount: "Field to save selection count",
    captionExportCSV: "Export to CSV",
    FieldmMappingText: "Route-Selection attribute transfer",
    RoutLayerField: "Route layer field",
    BussinessLayerField: "Selection layer field",
    lblAllowBarriers: "Allow barriers",
    lblAllowAccessPointLayerSelect: "Allow user to select access point layer",
    lblForBox: "Route result label",
    lblEnableSelectionLayer: "Enable selection layer",
    lblRouteCost: "Field to save route result expression",
    lblForRouteUnitLblPosition: "Result unit label position",
    lblForRadioBtnAfter: "After",
    lblForRadioBtnBefore: "Before",
    symbol: {
      barrier: "Barrier symbols",
      location: "Location symbol",
      route: "Route symbol",
      buffer: "Buffer symbol",
      business: "Selection symbol",
      pointBarrierSymbol: "Point barrier symbol",
      lineBarrierSymbol: "Line barrier symbol",
      polygonBarrierSymbol: "Polygon barrier symbol",
      pointLocationSymbol: "Point location symbol",
      businessSymbol: "Selection symbol",
      routeSymbol: "Route symbol",
      bufferSymbol: "Buffer symbol"
    },
    highlighter: {
      highlighterSection: "Highlighter image",
      imageUplaod: "Image",
      imageHeight: "Height",
      imageWidth: "Width",
      imageHighlightTimeout: "Timeout",
      pixel: "(Pixels)",
      milliseconds: "(Milliseconds)"
    },
    validationErrorMessage: {
      routeLengthErr: "Please specify ",
      greaterThanZeroMessage: " should be numeric value greater than 0.",
      highlighterImageErr: "Please select highlighter image.",
      andText: " and ",
      diffText: " should be different.",
      nullValueErr: "Specify numeric ${0} value ",
      valueNumberOnlyErr: "${0} value should be numeric only. ",
      minValueErr: "Maximum value should be greater than minimum value.",
      invalidClosestFacilityTask: "Please enter valid ",
      accessPointCheck: "No access point layers available to continue.",
      checkGeometryType: "Geometry type of target",
      BusinessGeometryType: " should be same as the geometry type of ",
      valueCharErr: "${0} value should be numeric only.",
      specifyText: "Specify",
      blankLayerErr: "Specify selection layer and route layer.",
      NoLayersInWebMap: "No selection layer available to continue.",
      defaultAttrLookupParamValueMsg: "Unsaved changes in attribute parameter lookup. Please refresh.",
      emptyLookupParamValueErr: "Lookup parameters cannot be empty.",
      minValueErrorLabel: "minimum",
      maxValueErrorLabel: "maximum",
      defaultValueErrorLabel: "default",
      NoFieldsInBusinessLayer: "No field to display as a title in result selection list.",
      invalidExpression: "Invalid expression.",
      emptyTextBoxForLabel: "Please specify ",
      emptyExpressionTextBox: "Please specify "
    },
    esriUnit: {
      esriCTMeters: "Meters",
      esriCTMiles: "Miles",
      esriCTFeets: "Feet",
      esriCTKilometers: "Kilometers",
      defaultUnit: "Default"
    },
    routeLengthroundingOption: {
      oneDecimalName: "one decimal",
      twoDecimalName: "two decimal",
      noDecimalName: "no decimal",
      tenDecimalName: "nearest 10",
      hunderedDecimalName: "nearest 100",
      thousandDecimalName: "nearest 1000",
      oneDecimalValue: "1",
      twoDecimalValue: "2",
      noDecimalValue: "0",
      tenDecimalValue: "10",
      hunderedDecimalValue: "100",
      thousandDecimalValue: "1000"
    },
    attributeParameter: {
      minText: "Min",
      maxText: "Max"
    },
    hintText: {
      bussinessesLayerText: "Hint: Select selection layer.",
      accessPointLayerText: "Hint: Select minimum one access point layer.",
      routeLengthUnitText: "Hint: Please provide a label for the result units. If displaying just the route length, please set this to basemap's linear distance unit (Meters or Feet).",
      roundingOptionHintText: "Hint: Select rounding option.",
      bussinessListText: "Hint: Select desired selection list field.",
      bufferDistanceText: "Hint: Specify a numeric value for buffer distance.",
      bufferUnitsText: "Hint: Select buffer unit.",
      closestFacilityText: "Hint: Specify the URL of closest facility.",
      facilitySearchDistanceText: "Hint: Specify a numeric value for facility search distance.",
      impedanceText: "Hint: Select impedance attribute.",
      cuttOffDistanceText: "Hint: Specify a numeric value for cut off distance.",
      lookupText: "Hint: Lookup for values if data type of attribute parameter is not an integer or a double.",
      lookupTextOnSet: "Click on 'Refresh' button to update 'Attribute parameter values' in 'Closest facility parameters' section.",
      AttributeParameterValueText1: "Hint: Minimum and maximum values should be numeric only.",
      AttributeParameterValueText2: "Configure attribute parameters from closest facility task.",
      bussinessLayerText: "Hint: Select a results selection layer whose geometry type is same as the selection layer.",
      routeLayerText: "Hint: Select route layer.",
      lengthUnitsText: "Hint: Select length conversion unit.",
      routeLengthText: "Hint: Select field of route layer to save route length.",
      routeNameFieldText: "Hint: Select route name field.",
      saveBussinessText: "Hint: Select field of route layer to save selection count.",
      saveBusinessNameField: "Hint: Select route name field for corresponding selection field.",
      exportToCSVText: "Hint: Select this option to export selection results to CSV.",
      imageHeightText: "Hint: Specify numeric value for image height.",
      imageWidthText: "Hint: Specify numeric value for image width.",
      imageTimeoutText: "Hint: Specify numeric value for highlight animation timeout.",
      selectImageHintText: "Hint: Please click on the image to select any other highlighter image.",
      allowUserAccessPointLayerSelectText: "Hint: When left unchecked, the nearest asset will be found from all selected access point layers in the list.",
      hintExpressionText: "Hint: Please enter an equation including the {Length} keyword. Providing just the {Length} keyword, will display only the route length in results.",
      hintLabelForBox: "Hint: Displayed on top in results panel.",
      routeCostText: "Hint: Select field of route layer to save result of expression.",
      resulUnitLabelPosition: "Please provide an option to show the label before or after the values."
    },
    invalidURL: " Please enter a valid ",
    allowToUserInput: "Allow user input",
    defaultToValue: "Default to value",
    valueText: "Value",
    lblAttributeParameterValues: "Custom attribute parameter values",
    defaultDataDictionaryValue: "Prohibited,Avoid_High,Avoid_Medium,Avoid_Low,Prefer_Low,Prefer_Medium,Prefer_High",
    lblTravelMode: "Use travel modes",
    testExpressionValue: "{Length}",
    closestFacilityLayerTitle: "Closest Facility Layer",
    closestFacilityLayerPopupTitle: "Select closest facility layer"
  }
});