﻿/// <reference path="PlotRegistry.ts" />
/// <reference path="../../typings/jquery/jquery.d.ts" />
/// <reference path="Utils.ts" />
declare var InteractiveDataDisplay: any;
declare var Microsoft: any;

module ChartViewer {
    module Markers {
        var defaultPalette = InteractiveDataDisplay.ColorPalette.parse("black,#e5e5e5");

        export function BuildPalette(plot: Plot.MarkersDefinition) {
            var d3Palette = plot.colorPalette ? InteractiveDataDisplay.ColorPalette.parse(plot.colorPalette) : defaultPalette;
            if (d3Palette.isNormalized) {
                var colorRange = { min: GetMin(plot.color), max: GetMax(plot.color) };
                if (colorRange.min === colorRange.max) 
                    d3Palette = d3Palette.absolute(colorRange.min - 0.5, colorRange.max + 0.5);
                else 
                    d3Palette = d3Palette.absolute(colorRange.min, colorRange.max);
            }
            return d3Palette;
        }

        export function BuildPaletteForUncertain(plot: Plot.MarkersDefinition) {
            var d3Palette = plot.colorPalette ? InteractiveDataDisplay.ColorPalette.parse(plot.colorPalette) : defaultPalette;
            if (d3Palette.isNormalized) {
                var color = <Plot.Quantiles>plot.color;
                var colorRange = {
                    min: GetMin(color.lower95),
                    max: GetMax(color.upper95)
                };
                if (colorRange.min > colorRange.max) {
                    d3Palette = d3Palette;
                }
                else if (colorRange.min === colorRange.max) {
                    d3Palette = d3Palette.absolute(colorRange.min - 0.5, colorRange.max + 0.5);
                } else {
                    d3Palette = d3Palette.absolute(colorRange.min, colorRange.max);
                }
            }
            return d3Palette;
        }

        export function BuildSizePalette(plot: Plot.MarkersDefinition) {
            var sizeRange = plot.sizeRange ? plot.sizeRange : { min: 5, max: 50 };
            var valueRange = { min: GetMin(plot.size), max: GetMax(plot.size) };
            return new InteractiveDataDisplay.SizePalette(false, sizeRange, valueRange);
        }
    }

    PlotRegistry["markers"] = {
        initialize(plotDefinition: PlotInfo, viewState: ViewState, chart: IDDPlot) {
            var div = $("<div></div>")
                .attr("data-idd-name", plotDefinition.displayName)
                .appendTo(chart.host);
            var markerGraph = new InteractiveDataDisplay.Markers(div, chart.master);
            chart.addChild(markerGraph);
            markerGraph.getTooltip = function (xd, yd, xp, yp) {
                if (markerGraph.ttData === undefined || markerGraph.ttFormatters === undefined)
                    return undefined;

                var resultMarkers = markerGraph.findToolTipMarkers(xd, yd, xp, yp);
                var buildTooltip = function (markerInfo) {

                    var index = markerInfo.index;

                    var content = undefined;
                    for (var prop in markerGraph.ttData) {
                        if (content) {
                            if (markerGraph.ttData[prop] != undefined && markerGraph.ttData[prop] instanceof Array)
                                if (markerGraph.ttData[prop].Column != undefined)
                                    content += "<br/>" + markerGraph.ttData[prop].Column + ": " + markerGraph.ttFormatters[prop].toString(markerGraph.ttData[prop][index]);
                                else
                                    content += "<br/>" + prop + ": " + markerGraph.ttFormatters[prop].toString(markerGraph.ttData[prop][index]);
                        } else {
                            if (markerGraph.ttData[prop] != undefined)
                                if (markerGraph.ttData[prop].Column != undefined)
                                    content = markerGraph.ttData[prop].Column + ": " + markerGraph.ttFormatters[prop].toString(markerGraph.ttData[prop][index]);
                                else
                                    content = prop + ": " + markerGraph.ttFormatters[prop].toString(markerGraph.ttData[prop][index]);
                        }
                    }
                    content += "<br/>index: " + index;
                    return "<div style='margin-left: 10px; font-size: 11pt;'>" + content + "</div>";
                };

                if (resultMarkers.length > 0) {
                    var result = $("<div></div>");
                    //var thumbnail = Markers.createThumbnail(<Plot.MarkersDefinition><any>plotDefinition);
                    //thumbnail.css("float", "left").css("margin-right", 3).appendTo(result);

                    var toolTip = plotDefinition.displayName != undefined ? plotDefinition.displayName : '(not specified)';
                    var ttHeader = $("<div></div>").addClass("probecard-title").text(toolTip);
                    toolTip = "";
                    for (var i = 0; i < resultMarkers.length; i++) {
                        toolTip += buildTooltip(resultMarkers[i]);
                        if (i < resultMarkers.length - 1) {
                            toolTip += "<br/>";
                        }
                    }
                    var ttContent = $("<div>" + toolTip + "</div>");
                    ttHeader.appendTo(result);
                    ttContent.appendTo(result);
                    return result;
                }
            };
            return [markerGraph];
        },

        draw(plots: IDDPlot[], plotDefinition: PlotInfo) {
                var plot = <Plot.MarkersDefinition><any>plotDefinition;
                if (!plot.shape) {
                    plot.shape = "box";
                }
                var drawArgs = {
                    x: undefined,
                    y: undefined,
                    shape: undefined,
                    u95: undefined,
                    l95: undefined,
                    u68: undefined,
                    l68: undefined,
                    y_mean: undefined,
                    color: undefined,
                    colorPalette: undefined,
                    //uncertainColorPalette: undefined,
                    size: undefined,
                    sizePalette: undefined,
                    //maxDelta: undefined,
                    bullEyeShape: undefined,
                    border: undefined
                };
                var toolTipData = {
                    x: undefined,
                    y: undefined,
                    median: undefined,
                    color: undefined,
                    size: undefined
                };
                var toolTipFormatters = {};
                var colorRange, sizeRange;
                drawArgs.border = plot.borderColor;
                if (plot.x == undefined && !InteractiveDataDisplay.Utils.isArray(plot.y)) {
                    plot.x = [];
                    for (var i = 0; i < plot.y["median"].length; i++) plot.x.push(i);
                }
                drawArgs.x = plot.x;
                if (drawArgs.y === undefined && InteractiveDataDisplay.Utils.isArray(plot.y))
                    drawArgs.y = plot.y;
                else
                    drawArgs.y = (<Plot.Quantiles><any>plot.y).median;

                var len = Math.min(drawArgs.x.length, drawArgs.y.length);
                if (drawArgs.y !== undefined) {
                    drawArgs.x = CutArray(drawArgs.x, len);
                    drawArgs.y = CutArray(drawArgs.y, len);
                }

                toolTipData[getTitle(plotDefinition, "x")] = drawArgs.x;

                if (plot.y !== undefined) {
                    toolTipData[getTitle(plotDefinition, "y")] = drawArgs.y;
                }
                var getDataFromPalette = function (data, d3Palette) {
                    var result = [];
                    var cl = Math.min(drawArgs.x.length, data.length);
                    for (var i = 0; i < cl; i++) {
                        var rgba = d3Palette ? d3Palette.getRgba(data[i]) : { r: 0, g: 0, b: 0, a: 0.2 };
                        result.push("rgba(" + rgba.r + "," + rgba.g + "," + rgba.b + "," + rgba.a + ")");
                    }
                    return result;
                }

                if (!InteractiveDataDisplay.Utils.isArray(plot.y)) {
                    //Y is uncertainty, using box&whisker
                    switch (plot.shape) {
                        case "boxnowhisker":
                            drawArgs.shape = InteractiveDataDisplay.BoxNoWhisker;
                            break;
                        case "boxwhisker":
                            drawArgs.shape = InteractiveDataDisplay.BoxWhisker;
                            break;
                        case "whisker":
                            drawArgs.shape = InteractiveDataDisplay.Whisker;
                            break;
                        default:
                            drawArgs.shape = InteractiveDataDisplay.BoxWhisker;
                            break;
                    }
                    var y = <Plot.Quantiles><any>plot.y;
                    drawArgs.u95 = y.upper95;
                    drawArgs.l95 = y.lower95;
                    drawArgs.u68 = y.upper68;
                    drawArgs.l68 = y.lower68;
                    drawArgs.y_mean = y.median;

                    toolTipData[getTitle(plotDefinition, "y") + " median"] = y.median;
                    toolTipData["upper 68%"] = y.upper68;
                    toolTipData["lower 68%"] = y.lower68;
                    toolTipData["upper 95%"] = y.upper95;
                    toolTipData["lower 95%"] = y.lower95;
                } else {
                    if (plot.shape === "boxnowhisker" || plot.shape === "boxwhisker" || plot.shape === "whisker")
                        plot.shape = "box";
                }

                if (typeof plot.color === "undefined") {
                    if (drawArgs.shape === undefined) drawArgs.shape = plot.shape;
                    if (InteractiveDataDisplay.Utils.isArray(plot.y)) drawArgs.color = plot.color = "#1F497D";
                }
                else if (typeof plot.color === "string") {
                    if (drawArgs.shape === undefined) drawArgs.shape = plot.shape;
                    drawArgs.color = <string>plot.color;

                }
                else if (InteractiveDataDisplay.Utils.isArray(plot.color)) {
                    if (drawArgs.shape === undefined) drawArgs.shape = plot.shape;
                    toolTipData[getTitle(plotDefinition, "color")] = plot.color;
                    drawArgs.color = plot.color;
                    drawArgs.colorPalette = Markers.BuildPalette(plot);
                } else {
                    //Color is uncertainty data, using bull eye markers
                    drawArgs.shape = InteractiveDataDisplay.BullEye;//Markers.BullEye;
                    drawArgs.bullEyeShape = plot.shape;

                    var color = <Plot.Quantiles>plot.color;

                    drawArgs.u95 = color.upper95;
                    drawArgs.l95 = color.lower95;
                    drawArgs.colorPalette = Markers.BuildPaletteForUncertain(plot);

                    if (plot.titles != undefined && plot.titles.color != undefined)
                        toolTipData[getTitle(plotDefinition, "color") + " median"] = color.median;
                    toolTipData["upper (95%)"] = color.upper95;
                    toolTipData["lower (95%)"] = color.lower95;
                }

                if (plot.size && typeof plot.size["median"] !== "undefined") {
                    var size = <Plot.Quantiles>plot.size;
                    //Size is uncertainty data, using petalled markers
                    drawArgs.shape = InteractiveDataDisplay.Petal;//Markers.Petal;
                    drawArgs.u95 = CutArray(size.upper95, len);
                    drawArgs.l95 = CutArray(size.lower95, len);

                    if (plot.titles != undefined && plot.titles.size != undefined)
                        toolTipData[getTitle(plotDefinition, "size") + " median"] = size.median;
                    else toolTipData["size median"] = size.median;
                    toolTipData["upper 95%"] = size.upper95;
                    toolTipData["lower 95%"] = size.lower95;

                    //var i = 0;
                    //while (isNaN(size.upper95[i]) || isNaN(size.lower95[i])) i++;
                    //var maxDelta = size.upper95[i] - size.lower95[i];
                    //i++;
                    //for (; i < size.upper95.length; i++)
                    //    if (!isNaN(size.upper95[i]) && !isNaN(size.lower95[i]))
                    //        maxDelta = Math.max(maxDelta, size.upper95[i] - size.lower95[i]);
                    //drawArgs.maxDelta = maxDelta;

                    //sizeRange = { from: 0, to: maxDelta };
                    drawArgs.size = 15;
                }
                else if (InteractiveDataDisplay.Utils.isArray(plot.size)) {
                    toolTipData[getTitle(plotDefinition, "size")] = plot.size;
                    drawArgs.sizePalette = Markers.BuildSizePalette(plot);
                    drawArgs.size = <number[]>plot.size;
                }
                else if (plot.size) {
                    drawArgs.size = <number>plot.size;
                }
                else {
                    drawArgs.size = plot.size = 8;
                }
                plots[0].draw(drawArgs, plot.titles);

                var getRange = function (arr) {
                    return { min: GetMin(arr), max: GetMax(arr) }
                }

                for (var prop in toolTipData) {
                    toolTipFormatters[prop] = getFormatter(toolTipData[prop], getRange);
                }

                plots[0].ttData = toolTipData;
                plots[0].ttFormatters = toolTipFormatters;

                var res = {
                    x: { min: GetMin(drawArgs.x), max: GetMax(drawArgs.x) },
                    y: { min: GetMin(drawArgs.y), max: GetMax(drawArgs.y) },
                    color: undefined,
                    size: undefined
                };
                if (colorRange)
                    res.color = colorRange;
                if (sizeRange)
                    res.size = sizeRange;
                return res;
            
        }
    }
}