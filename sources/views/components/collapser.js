import utils from "../../utils/utils";
import constants from "../../constants";

function changeDataviewItemDimensions(collapsedView) {
	if (collapsedView.config.id === constants.SCROLL_VIEW_METADATA_ID) {
		const galleryRichselect = $$(constants.ID_GALLERY_RICHSELECT);
		let dataviewSelectionId = utils.getDataviewSelectionId();
		if (dataviewSelectionId && dataviewSelectionId !== constants.DEFAULT_DATAVIEW_COLUMNS) {
			galleryRichselect.callEvent("onChange", [dataviewSelectionId]);
		}
	}
}

function getConfig(collapsedViewId, config, collapserName) {
	const BTN_CLOSED_STATE_ID = `collapser-btn-closed-${webix.uid()}`;
	const BTN_OPENED_STATE_ID = `collapser-btn-opened-${webix.uid()}`;
	return {
		css: "collapser",
		width: 23,
		name: collapserName,
		rows: [
			{
				view: "template",
				template: config && config.type === "left" ?
					"<span class='webix_icon fa-angle-left'></span>" :
					"<span class='webix_icon fa-angle-right'></span>",
				css: "collapser-btn",
				id: BTN_OPENED_STATE_ID,
				hidden: config && config.closed,
				onClick: {
					"collapser-btn": function () {
						const collapsedView = $$(collapsedViewId);
						collapsedView.hide();
						this.hide();
						$$(BTN_CLOSED_STATE_ID).show();
						webix.ui.resize();
						changeDataviewItemDimensions(collapsedView);
					}
				}
			},
			{
				view: "template",
				template: config && config.type === "left" ?
					"<span class='webix_icon fa-angle-right'></span>" :
					"<span class='webix_icon fa-angle-left'></span>",
				css: "collapser-btn",
				id: BTN_CLOSED_STATE_ID,
				hidden: !(config && config.closed),
				onClick: {
					"collapser-btn": function () {
						const collapsedView = $$(collapsedViewId);
						collapsedView.show();
						this.hide();
						$$(BTN_OPENED_STATE_ID).show();
						webix.ui.resize();
						changeDataviewItemDimensions(collapsedView);
					}
				}
			}
		]
	};
}

export default {
	getConfig
};
