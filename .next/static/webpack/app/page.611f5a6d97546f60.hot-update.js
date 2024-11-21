"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
self["webpackHotUpdate_N_E"]("app/page",{

/***/ "(app-pages-browser)/./src/components/EditButton.tsx":
/*!***************************************!*\
  !*** ./src/components/EditButton.tsx ***!
  \***************************************/
/***/ (function(module, __webpack_exports__, __webpack_require__) {

eval(__webpack_require__.ts("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   EditButton: function() { return /* binding */ EditButton; }\n/* harmony export */ });\n/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react/jsx-dev-runtime */ \"(app-pages-browser)/./node_modules/next/dist/compiled/react/jsx-dev-runtime.js\");\n/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ \"(app-pages-browser)/./node_modules/next/dist/compiled/react/index.js\");\n/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_1__);\n/* harmony import */ var _ReservationForm__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./ReservationForm */ \"(app-pages-browser)/./src/components/ReservationForm.tsx\");\n\nvar _s = $RefreshSig$();\n\n\nfunction EditButton(param) {\n    let { reservationId, initialData, onSuccess } = param;\n    _s();\n    const [isEditing, setIsEditing] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(false);\n    const handleEdit = async (updatedData)=>{\n        try {\n            await fetch(\"/api/reservations/\".concat(reservationId), {\n                method: \"PUT\",\n                headers: {\n                    \"Content-Type\": \"application/json\"\n                },\n                body: JSON.stringify(updatedData)\n            });\n            setIsEditing(false);\n            onSuccess === null || onSuccess === void 0 ? void 0 : onSuccess();\n        } catch (error) {\n            console.error(\"Failed to update reservation:\", error);\n        }\n    };\n    return /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.Fragment, {\n        children: !isEditing ? /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(\"button\", {\n            className: \"bg-red-600 hover:bg-red-700 inline-flex items-center px-6 py-3 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 mx-2\",\n            onClick: ()=>setIsEditing(true),\n            children: \"Edit Reservation\"\n        }, void 0, false, {\n            fileName: \"/Users/james/Documents/reservr/project/src/components/EditButton.tsx\",\n            lineNumber: 33,\n            columnNumber: 17\n        }, this) : /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(_ReservationForm__WEBPACK_IMPORTED_MODULE_2__.ReservationForm, {\n            initialData: initialData,\n            onSubmit: handleEdit,\n            isEditing: true,\n            onCancel: ()=>setIsEditing(false)\n        }, void 0, false, {\n            fileName: \"/Users/james/Documents/reservr/project/src/components/EditButton.tsx\",\n            lineNumber: 40,\n            columnNumber: 17\n        }, this)\n    }, void 0, false);\n}\n_s(EditButton, \"N4qUVpaen/rROL8jPu/4huFD8lA=\");\n_c = EditButton;\nvar _c;\n$RefreshReg$(_c, \"EditButton\");\n\n\n;\n    // Wrapped in an IIFE to avoid polluting the global scope\n    ;\n    (function () {\n        var _a, _b;\n        // Legacy CSS implementations will `eval` browser code in a Node.js context\n        // to extract CSS. For backwards compatibility, we need to check we're in a\n        // browser context before continuing.\n        if (typeof self !== 'undefined' &&\n            // AMP / No-JS mode does not inject these helpers:\n            '$RefreshHelpers$' in self) {\n            // @ts-ignore __webpack_module__ is global\n            var currentExports = module.exports;\n            // @ts-ignore __webpack_module__ is global\n            var prevSignature = (_b = (_a = module.hot.data) === null || _a === void 0 ? void 0 : _a.prevSignature) !== null && _b !== void 0 ? _b : null;\n            // This cannot happen in MainTemplate because the exports mismatch between\n            // templating and execution.\n            self.$RefreshHelpers$.registerExportsForReactRefresh(currentExports, module.id);\n            // A module can be accepted automatically based on its exports, e.g. when\n            // it is a Refresh Boundary.\n            if (self.$RefreshHelpers$.isReactRefreshBoundary(currentExports)) {\n                // Save the previous exports signature on update so we can compare the boundary\n                // signatures. We avoid saving exports themselves since it causes memory leaks (https://github.com/vercel/next.js/pull/53797)\n                module.hot.dispose(function (data) {\n                    data.prevSignature =\n                        self.$RefreshHelpers$.getRefreshBoundarySignature(currentExports);\n                });\n                // Unconditionally accept an update to this module, we'll check if it's\n                // still a Refresh Boundary later.\n                // @ts-ignore importMeta is replaced in the loader\n                module.hot.accept();\n                // This field is set when the previous version of this module was a\n                // Refresh Boundary, letting us know we need to check for invalidation or\n                // enqueue an update.\n                if (prevSignature !== null) {\n                    // A boundary can become ineligible if its exports are incompatible\n                    // with the previous exports.\n                    //\n                    // For example, if you add/remove/change exports, we'll want to\n                    // re-execute the importing modules, and force those components to\n                    // re-render. Similarly, if you convert a class component to a\n                    // function, we want to invalidate the boundary.\n                    if (self.$RefreshHelpers$.shouldInvalidateReactRefreshBoundary(prevSignature, self.$RefreshHelpers$.getRefreshBoundarySignature(currentExports))) {\n                        module.hot.invalidate();\n                    }\n                    else {\n                        self.$RefreshHelpers$.scheduleUpdate();\n                    }\n                }\n            }\n            else {\n                // Since we just executed the code for the module, it's possible that the\n                // new exports made it ineligible for being a boundary.\n                // We only care about the case when we were _previously_ a boundary,\n                // because we already accepted this update (accidental side effect).\n                var isNoLongerABoundary = prevSignature !== null;\n                if (isNoLongerABoundary) {\n                    module.hot.invalidate();\n                }\n            }\n        }\n    })();\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKGFwcC1wYWdlcy1icm93c2VyKS8uL3NyYy9jb21wb25lbnRzL0VkaXRCdXR0b24udHN4IiwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBaUM7QUFDbUI7QUFRN0MsU0FBU0UsV0FBVyxLQUEwRDtRQUExRCxFQUFFQyxhQUFhLEVBQUVDLFdBQVcsRUFBRUMsU0FBUyxFQUFtQixHQUExRDs7SUFDdkIsTUFBTSxDQUFDQyxXQUFXQyxhQUFhLEdBQUdQLCtDQUFRQSxDQUFDO0lBRTNDLE1BQU1RLGFBQWEsT0FBT0M7UUFDdEIsSUFBSTtZQUNBLE1BQU1DLE1BQU0scUJBQW1DLE9BQWRQLGdCQUFpQjtnQkFDOUNRLFFBQVE7Z0JBQ1JDLFNBQVM7b0JBQ0wsZ0JBQWdCO2dCQUNwQjtnQkFDQUMsTUFBTUMsS0FBS0MsU0FBUyxDQUFDTjtZQUN6QjtZQUVBRixhQUFhO1lBQ2JGLHNCQUFBQSxnQ0FBQUE7UUFDSixFQUFFLE9BQU9XLE9BQU87WUFDWkMsUUFBUUQsS0FBSyxDQUFDLGlDQUFpQ0E7UUFDbkQ7SUFDSjtJQUVBLHFCQUNJO2tCQUNLLENBQUNWLDBCQUNFLDhEQUFDWTtZQUFPQyxXQUFVO1lBQ2RDLFNBQVMsSUFBTWIsYUFBYTtzQkFFL0I7Ozs7O2lDQUlELDhEQUFDTiw2REFBZUE7WUFDWkcsYUFBYUE7WUFDYmlCLFVBQVViO1lBQ1ZGLFdBQVc7WUFDWGdCLFVBQVUsSUFBTWYsYUFBYTs7Ozs7OztBQUtqRDtHQXZDZ0JMO0tBQUFBIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vX05fRS8uL3NyYy9jb21wb25lbnRzL0VkaXRCdXR0b24udHN4PzZiZTQiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgdXNlU3RhdGUgfSBmcm9tICdyZWFjdCc7XG5pbXBvcnQgeyBSZXNlcnZhdGlvbkZvcm0gfSBmcm9tICcuL1Jlc2VydmF0aW9uRm9ybSc7XG5cbmludGVyZmFjZSBFZGl0QnV0dG9uUHJvcHMge1xuICAgIHJlc2VydmF0aW9uSWQ6IHN0cmluZztcbiAgICBpbml0aWFsRGF0YTogUmVzZXJ2YXRpb25EYXRhO1xuICAgIG9uU3VjY2Vzcz86ICgpID0+IHZvaWQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBFZGl0QnV0dG9uKHsgcmVzZXJ2YXRpb25JZCwgaW5pdGlhbERhdGEsIG9uU3VjY2VzcyB9OiBFZGl0QnV0dG9uUHJvcHMpIHtcbiAgICBjb25zdCBbaXNFZGl0aW5nLCBzZXRJc0VkaXRpbmddID0gdXNlU3RhdGUoZmFsc2UpO1xuXG4gICAgY29uc3QgaGFuZGxlRWRpdCA9IGFzeW5jICh1cGRhdGVkRGF0YTogUmVzZXJ2YXRpb25EYXRhKSA9PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCBmZXRjaChgL2FwaS9yZXNlcnZhdGlvbnMvJHtyZXNlcnZhdGlvbklkfWAsIHtcbiAgICAgICAgICAgICAgICBtZXRob2Q6ICdQVVQnLFxuICAgICAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHVwZGF0ZWREYXRhKSxcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBzZXRJc0VkaXRpbmcoZmFsc2UpO1xuICAgICAgICAgICAgb25TdWNjZXNzPy4oKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byB1cGRhdGUgcmVzZXJ2YXRpb246JywgZXJyb3IpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIHJldHVybiAoXG4gICAgICAgIDw+XG4gICAgICAgICAgICB7IWlzRWRpdGluZyA/IChcbiAgICAgICAgICAgICAgICA8YnV0dG9uIGNsYXNzTmFtZT1cImJnLXJlZC02MDAgaG92ZXI6YmctcmVkLTcwMCBpbmxpbmUtZmxleCBpdGVtcy1jZW50ZXIgcHgtNiBweS0zIHRleHQtd2hpdGUgdGV4dC1zbSBmb250LW1lZGl1bSByb3VuZGVkLWxnIGhvdmVyOmJnLWluZGlnby03MDAgZm9jdXM6b3V0bGluZS1ub25lIGZvY3VzOnJpbmctMiBmb2N1czpyaW5nLW9mZnNldC0yIG14LTJcIlxuICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRJc0VkaXRpbmcodHJ1ZSl9XG5cbiAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgIEVkaXQgUmVzZXJ2YXRpb25cbiAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICAgICAgPFJlc2VydmF0aW9uRm9ybVxuICAgICAgICAgICAgICAgICAgICBpbml0aWFsRGF0YT17aW5pdGlhbERhdGF9XG4gICAgICAgICAgICAgICAgICAgIG9uU3VibWl0PXtoYW5kbGVFZGl0fVxuICAgICAgICAgICAgICAgICAgICBpc0VkaXRpbmc9e3RydWV9XG4gICAgICAgICAgICAgICAgICAgIG9uQ2FuY2VsPXsoKSA9PiBzZXRJc0VkaXRpbmcoZmFsc2UpfVxuICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICApfVxuICAgICAgICA8Lz5cbiAgICApO1xufVxuIl0sIm5hbWVzIjpbInVzZVN0YXRlIiwiUmVzZXJ2YXRpb25Gb3JtIiwiRWRpdEJ1dHRvbiIsInJlc2VydmF0aW9uSWQiLCJpbml0aWFsRGF0YSIsIm9uU3VjY2VzcyIsImlzRWRpdGluZyIsInNldElzRWRpdGluZyIsImhhbmRsZUVkaXQiLCJ1cGRhdGVkRGF0YSIsImZldGNoIiwibWV0aG9kIiwiaGVhZGVycyIsImJvZHkiLCJKU09OIiwic3RyaW5naWZ5IiwiZXJyb3IiLCJjb25zb2xlIiwiYnV0dG9uIiwiY2xhc3NOYW1lIiwib25DbGljayIsIm9uU3VibWl0Iiwib25DYW5jZWwiXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(app-pages-browser)/./src/components/EditButton.tsx\n"));

/***/ })

});