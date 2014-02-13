module.exports = (function () {

    function ___generateNonLatinCode() {
        var str = "ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩΆΈΉΊΌΎΏαβγδεζηθικλμνξοπρστυφχψωάέήίόύώ";
        var arr = [];
        str.split("").map(function (c) {
            var c16 = c.charCodeAt(0).toString(16);
            var c10 = c.charCodeAt(0).toString(10);
            arr.push("if (c === \"\\x" + c16 + "\") return c.replace(\"\\x" + c16 + "\", \"&#" + c10 + ";\"); // " + c);
            return c;
        });
        return arr;
    }

    return {
        toDB          : function (str) {
            str = (typeof str !== "string" ? (str ? str.toString : "") : str);
            return str.split("")
                .map(function (c) {
                    return c.replace("\\", "\\\\")
                        .replace("\"", "\\\"")
                        .replace("\'", "\\\'")
                        .replace("\r", "\\r")
                        .replace("\n", "\\n")
                        .replace("\t", "\\\t");
                    //.replace("&", "\\x26")
                    //.replace("%", "\\%")
                    //.replace("_", "\\_")
                    //.replace("<", "\\x3C")
                    //.replace(">", "\\x3E");
                }).join("");
        },
        toHtml        : function (str) {
            str = (typeof str !== "string" ? (str ? str.toString : "") : str);
            return str.split("")
                .map(function (c) {
                    //noinspection JSValidateTypes
                    return c.replace("\x26", "&#38;") // &
                        .replace("\x20", "&#32;") // space
                        .replace("\x21", "&#33;") // !
                        .replace("\x22", "&#34;") // "
                        //.replace("\x23", "&#35;") // #
                        .replace("\x24", "&#36;") // $
                        .replace("\x25", "&#37;") // %
                        .replace("\x27", "&#39;") // '
                        .replace("\x28", "&#40;") // (
                        .replace("\x29", "&#41;") // )
                        .replace("\x2A", "&#42;") // *
                        .replace("\x2B", "&#43;") // +
                        .replace("\x2C", "&#44;") // ,
                        .replace("\x2D", "&#45;") // -
                        .replace("\x2E", "&#46;") // .
                        .replace("\x2F", "&#47;") // /
                        .replace("\x3A", "&#58;") // :
                        //.replace("\x3B", "&#59;") // ;
                        .replace("\x3C", "&#60;") // <
                        .replace("\x3D", "&#61;") // =
                        .replace("\x3E", "&#62;") // >
                        .replace("\x3F", "&#63;") // ?
                        .replace("\x40", "&#64;") // @
                        .replace("\x5B", "&#91;") // [
                        .replace("\x5C", "&#92;") // \
                        .replace("\x5D", "&#93;") // ]
                        .replace("\x5E", "&#94;") // ^
                        .replace("\x5F", "&#95;") // _
                        .replace("\x60", "&#96;") // `
                        .replace("\x7B", "&#123;") // {
                        .replace("\x7C", "&#124;") // |
                        .replace("\x7D", "&#125;") // }
                        .replace("\x7E", "&#126;"); // ~
                }).join("");
        },
        escapeNonLatin: function (str) {
            str = (typeof str !== "string" ? (str ? str.toString : "") : str);
            return str.split("")
                .map(function (c) {
                    if(!c.match(/[a-zA-Z0-9\>\<\,\.\/\?\`\~\!\@\#\$\%\^\&\*\(\)\-\_\+\=\{\}\[\]\;\:\"\'\\\s]/gi)) {
                        c = c.replace(c, "&#"+c.charCodeAt(0).toString(10)+";");
                    }
                    return c;
                }).join("");
        }
    };
})();
