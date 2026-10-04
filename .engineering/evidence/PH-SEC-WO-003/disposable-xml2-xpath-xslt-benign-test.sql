CREATE EXTENSION xml2;
SELECT xpath_string($doc$<!DOCTYPE root [<!ELEMENT root EMPTY>]><root><child>benign</child></root>$doc$, 'string(/root/child)') AS xpath_result;
SELECT xslt_process($doc$<!DOCTYPE root [<!ELEMENT root EMPTY>]><root><child/></root>$doc$, $style$<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"><xsl:output method="text"/><xsl:template match="/">benign-xslt</xsl:template></xsl:stylesheet>$style$) AS xslt_result;
