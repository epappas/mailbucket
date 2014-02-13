module.exports = (function (salt, char) {

    function chr(AsciiNum) {
        return String.fromCharCode(AsciiNum);
    }

    function ord(string) {
        var str = string + '',
            code = str.charCodeAt(0);
        if (0xD800 <= code && code <= 0xDBFF) { // High surrogate (could change last hex to 0xDB7F to treat high private surrogates as single characters)
            var hi = code;
            if (str.length === 1) {
                return code; // This is just a high surrogate with no following low surrogate, so we return its value;
                // we could also throw an error as it is not a complete character, but someone may want to know
            }
            var low = str.charCodeAt(1);
            return ((hi - 0xD800) * 0x400) + (low - 0xDC00) + 0x10000;
        }
        if (0xDC00 <= code && code <= 0xDFFF) { // Low surrogate
            return code; // This is just a low surrogate with no preceding high surrogate, so we return its value;
            // we could also throw an error as it is not a complete character, but someone may want to know
        }
        return code;
    }

    return ({
        SALT         : salt,
        CHAR_CODE    : char,
        encryptSymbol: function (c) {
            return chr(this.CHAR_CODE + (c & 240) / 16) + '' + chr(this.CHAR_CODE + (c & 15));
        },
        encrypt      : function (str) {
            if (str === "") {
                return str;
            }
            var enc = Math.random(1, 255); // generate random salt.
            var result = "S" + '' + this.encryptSymbol(enc); // include salt in the result;
            enc ^= this.SALT;
            for (var i = 0; i < str.length; i++) {
                var r = ord(str.substr(i, 1)) ^ enc++;
                if (enc > 255) {
                    enc = 0;
                }
                result += this.encryptSymbol(r);
            }
            return result;
        },
        decryptSymbol: function (s, i) {
            // s is a text-encoded string, i is index of 2-char code. function returns number in range 0-255
            return (ord(s.substr(i, 1)) - this.CHAR_CODE) * 16 + ord(s.substr(i + 1, 1)) - this.CHAR_CODE;
        },
        decrypt      : function (str) {
            if (str === "") {
                return str;
            }
            var crypt_method = str.substr(0, 1);
            str = str.substr(1);
            var enc = salt ^ this.decryptSymbol(str, 0);
            var result = "";

            for (var i = 2; i < str.length; i += 2) { // i=2 to skip salt
                result += chr(this.decryptSymbol(str, i) ^ enc++);
                if (enc > 255) {
                    enc = 0;
                }
            }
            return result;
        }
    });
});
