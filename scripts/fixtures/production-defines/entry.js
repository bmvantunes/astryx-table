/*! Diagnostic spelling in a comment: __ASTRYX_TABLE_DEVELOPMENT__ */
const prefix__ASTRYX_TABLE_DEVELOPMENT__suffix = "larger identifier";
const properties = { __ASTRYX_TABLE_DEVELOPMENT__: "property name" };
function shadow(__ASTRYX_TABLE_DEVELOPMENT__) {
  return __ASTRYX_TABLE_DEVELOPMENT__;
}

export const evidence = {
  development: __ASTRYX_TABLE_DEVELOPMENT__,
  testDiagnostics: __ASTRYX_TABLE_TEST_DIAGNOSTICS__,
  literal: "__ASTRYX_TABLE_DEVELOPMENT__ __ASTRYX_TABLE_TEST_DIAGNOSTICS__",
  larger: prefix__ASTRYX_TABLE_DEVELOPMENT__suffix,
  property: properties.__ASTRYX_TABLE_DEVELOPMENT__,
  shadow: shadow("local binding"),
};
