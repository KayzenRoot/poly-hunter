SELECT current_setting('server_version') AS server_version;
SHOW xmloption;
SELECT xml_is_well_formed_document('<root><item>benign</item></root>') AS well_formed;
SELECT xpath('/root/item/text()', '<root><item>benign</item></root>'::xml) AS xpath_result;
SELECT xmlserialize(document xmlparse(document '<root/>') AS text) AS xml_roundtrip;
