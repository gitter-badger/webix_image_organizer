import EditColumnsWindow from "../../views/subviews/metadataTable/windows/editColumnsWindow";
import metadataTableModel from "../../models/metadataTableModel";
import authService from "../authentication";
import UniqueValuesWindow from "../../views/subviews/metadataTable/windows/uniqueValuesWindow";
import ajaxActions from "../ajaxActions";

let columnsConfigForDelete = [];
let datatableColumnsConfig = [];

class MetadataTableService {
	constructor(view, metadataTable, addColumnButton, exportButton, metadataTableThumbnailsTemplate) {
		this._view = view;
		this._metadataTable = metadataTable;
		this._addColumnButton = addColumnButton;
		this._exportButton = exportButton;
		this._metadataTableThumbnailsTemplate = metadataTableThumbnailsTemplate;
		this._ready();
	}

	_ready() {
		if (authService.isLoggedIn()) {
			this._metadataTable.define("dragColumn", "true");
			this._metadataTable.define("resizeColumn", "true");
			this.userInfo = authService.getUserInfo();
		}
		webix.extend(this._view, webix.ProgressBar);

		this._editColumnsWindow = this._view.$scope.ui(EditColumnsWindow);
		this._uniqueValuesWindow = this._view.$scope.ui(UniqueValuesWindow);
		this._addColumnButton.attachEvent("onItemClick", () => {
			let addButtonPromise = new Promise((success) => {
				let existedColumns = webix.toArray(this._metadataTable.config.columns);
				this._metadataTable.find((obj) => {
					if (obj.hasOwnProperty("meta")) {
						this._createColumnsConfig(obj.meta);
						return obj;
					}
				}, true);
				existedColumns.each((columnConfig) => {
					this._checkColumnsForDelete(columnConfig);
				});
				return success();
			});
			addButtonPromise.then(() => {
				this._editColumnsWindow.showWindow(datatableColumnsConfig, columnsConfigForDelete, this._metadataTable);
				datatableColumnsConfig = [];
				columnsConfigForDelete = [];
			});
		});

		this._editColumnsWindow.getRoot().attachEvent("onHide", () => {
			let newDatatableColumns = metadataTableModel.getColumnsForDatatable(this._metadataTable);
			this._setColspansForColumnsHeader(newDatatableColumns);
			metadataTableModel.putInLocalStorage(newDatatableColumns, authService.getUserInfo()._id);
			this._metadataTable.refreshColumns(newDatatableColumns);
		});

		this._metadataTable.attachEvent("onBeforeColumnDrop", (sourceId, targetId) => {
			let columnsConfig;
			const localStorageColumnsConfig = metadataTableModel.getLocalStorageColumnsConfig();

			if (localStorageColumnsConfig) {
				columnsConfig = localStorageColumnsConfig;
			} else {
				columnsConfig = metadataTableModel.getInitialColumnsForDatatable();
			}
			const arrayLength = columnsConfig.length;
			let sourceIndex;
			let targetIndex;
			for (let index = 0; index < arrayLength; index++) {
				const columnHeader = columnsConfig[index].header;
				if (Array.isArray(columnHeader)) {
					columnHeader.forEach((columnHeaderValue) => {
						if (columnHeaderValue instanceof Object) {
							delete columnHeaderValue.colspan;
							delete columnHeaderValue.$colspan;
							delete columnHeaderValue.css;
						}
					});
				}
				if (columnsConfig[index].id === sourceId) {
					sourceIndex = index;
				} else if (columnsConfig[index].id === targetId) {
					targetIndex = index;
				}
			}
			const movedColumnsArray = this._arrayMove(columnsConfig, arrayLength, sourceIndex, targetIndex);
			this._setColspansForColumnsHeader(movedColumnsArray);
			metadataTableModel.putInLocalStorage(movedColumnsArray, this.userInfo._id);
			const newDatatableColumns = metadataTableModel.getColumnsForDatatable(this._metadataTable);
			this._metadataTable.refreshColumns(newDatatableColumns);
		});

		this._metadataTable.on_click["fa-pencil"] = (e, obj) => {
			let uniqueValuesArray = [];
			let columnId = obj.column;
			this._metadataTable.eachRow((rowId) => {
				let columnValue = this._metadataTable.getText(rowId, columnId);
				if (columnValue && uniqueValuesArray.indexOf(columnValue) === -1 && columnValue !== "No metadata for item") {
					uniqueValuesArray.push(columnValue);
				}
			});
			this._uniqueValuesWindow.showWindow(columnId, uniqueValuesArray);
		};

		this._exportButton.attachEvent("onItemClick", () => {
			this._view.$scope.exportToExcel();
		});

		this._metadataTable.attachEvent("onAfterSelect", (id) => {
			const currentItem = this._metadataTable.getItem(id);
			this._metadataTableThumbnailsTemplate.parse(currentItem);
		});

		this._metadataTable.attachEvent("onAfterLoad", () => {
			const newDatatableColumns = metadataTableModel.getColumnsForDatatable(this._metadataTable);
			this._metadataTable.refreshColumns(newDatatableColumns);
		});

		this._metadataTable.attachEvent("onAfterEditStart", (infoObject) => {
			const columnId = infoObject.column;
			const editor = this._metadataTable.getEditor();
			const rowId = infoObject.row;
			const item = this._metadataTable.getItem(rowId);
			let editValue = "";

			if (item.hasOwnProperty("meta")) {
				editValue = metadataTableModel.getOrEditMetadataColumnValue(item, `meta.${columnId}`);
			}

			editor.setValue(editValue);
		});

		this._metadataTable.attachEvent("onBeforeEditStop", (values, obj) => {
			if (values.old !== values.value) {
				const columnId = obj.column;
				const rowId = obj.row;
				const itemToEdit = this._metadataTable.getItem(rowId);
				const copyOfAnItemToEdit = webix.copy(itemToEdit);

				if (copyOfAnItemToEdit.hasOwnProperty("meta")) {
					metadataTableModel.getOrEditMetadataColumnValue(copyOfAnItemToEdit.meta, `meta.${columnId}`, values.value);

					this._view.showProgress();
					ajaxActions.updateItemMetadata(itemToEdit._id, copyOfAnItemToEdit.meta)
						.then(() => {
							this._metadataTable.updateItem(rowId, copyOfAnItemToEdit);
							webix.message(`${columnId} column was successfully updated!`);
							this._view.hideProgress();
						})
						.fail(() => {
							this._view.hideProgress();
						});
				}
			}
		});
	}

	_arrayMove (array, length, oldIndex, newIndex) {
		if (newIndex >= length) {
			let key = newIndex - length + 1;
			while (key--) {
				array.push(undefined);
			}
		}
		array.splice(newIndex, 0, array.splice(oldIndex, 1)[0]);
		return array;
	}

	_checkColumnsForDelete(columnConfig) {
		let hasPushed = false;
		let length = columnsConfigForDelete.length;
		if (length > 0) {
			columnsConfigForDelete.find((obj) => {
				if (obj.id === columnConfig.id){
					hasPushed = true;
				}
			});
			if (!hasPushed) {
				columnsConfigForDelete.push(columnConfig);
			}
		} else {
			columnsConfigForDelete.push(columnConfig);
		}
	}

	_createColumnsConfig(obj, nestLevel = 0, header = [], path = "", objectKey) {
		Object.entries(obj).forEach(([key, value]) => {
			if (path.length === 0) {
				path = key;
			} else {
				path+= `.${key}`;
			}
			if (value instanceof Object) {
				header.push({text: key});
				this._createColumnsConfig(value, nestLevel++, header, path, key);
			} else {
				if (!objectKey) {
					path = key;
					header = [];
				}
				datatableColumnsConfig.push({
					id: path,
					header: header.concat(key)
				});
				if (objectKey) {
					path = path.substring(0, path.indexOf("."));
				}
			}
		});
	}

	_setColspansForColumnsHeader(newDatatableColumns) {
		let colspanInfoArray = [];
		let colspanIndex = 0;
		for (let index = 0; index < newDatatableColumns.length; index++) {

			if (newDatatableColumns[index].metadataColumn) {
				const columnHeader = newDatatableColumns[index].header;

				if (Array.isArray(columnHeader)) {
					let nextColumnIndex = index + 1;

					while (nextColumnIndex) {
						let unfoundValuesArray = [];
						const nextColumnConfig = newDatatableColumns[nextColumnIndex];

						if (nextColumnConfig && nextColumnConfig.metadataColumn) {
							const nextColumnHeader = nextColumnConfig.header;
							if (Array.isArray(nextColumnHeader)) {
								columnHeader.forEach((headerValue, headerIndex) => {
									if (headerValue instanceof Object && nextColumnHeader[headerIndex] instanceof Object && !headerValue.hasOwnProperty("content")) {
										if (headerValue.text === nextColumnHeader[headerIndex].text) {
											if (colspanInfoArray.length === 0 || !colspanInfoArray[colspanIndex]) {
												colspanInfoArray.push([{
													columnIndex: index,
													headerIndex: headerIndex,
													colspanValue: 2
												}]);
											} else {
												const neededHeaderIndex = colspanInfoArray[colspanIndex].findIndex(colspanInfoValues => colspanInfoValues.headerIndex === headerIndex);
												if (neededHeaderIndex !== -1) {
													++colspanInfoArray[colspanIndex][neededHeaderIndex].colspanValue;
												} else {
													colspanInfoArray[colspanIndex].push({
														columnIndex: index,
														headerIndex: headerIndex,
														colspanValue: 2
													});
												}
											}
										} else {
											unfoundValuesArray.push("nothing has found");
										}
									} else {
										unfoundValuesArray.push("nothing has found");
									}
								});

							} else {
								if (colspanInfoArray.length !== 0) {
									index = nextColumnIndex;
								}
								break;
							}
							if (unfoundValuesArray.length === columnHeader.length) {
								if (colspanInfoArray.length !== 0) {
									index = nextColumnIndex;
								}
								break;
							} else {
								++nextColumnIndex;
							}
						} else {
							if (colspanInfoArray.length !== 0) {
								index = nextColumnIndex;
							}
							break;
						}
					}
				}
				if (colspanInfoArray.length !== 0) {
					++colspanIndex;
				}
			}
		}

		colspanInfoArray.forEach((colspanInfo) => {
			colspanInfo.forEach((colspanInfoValues) => {
				const columnIndex = colspanInfoValues.columnIndex;
				const headerIndex = colspanInfoValues.headerIndex;
				const colspanValue = colspanInfoValues.colspanValue;
				const headerForColspan = newDatatableColumns[columnIndex].header[headerIndex];
				if (headerForColspan instanceof Object) {
					headerForColspan["colspan"] = colspanValue;
					headerForColspan["css"] = "column-header-top-name";
				}
			});
		});
	}
}

export default MetadataTableService;