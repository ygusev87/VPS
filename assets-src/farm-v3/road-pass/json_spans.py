"""Locate JSON value tokens without reformatting any surrounding source bytes."""
import json


def spans(text):
    out = {}
    decoder = json.JSONDecoder()

    def skip(i):
        while i < len(text) and text[i].isspace():
            i += 1
        return i

    def value(i, path):
        i = skip(i)
        start = i
        if text[i] == '{':
            i = skip(i + 1)
            keys = set()
            while text[i] != '}':
                key, i = decoder.raw_decode(text, i)
                assert isinstance(key, str) and key not in keys
                keys.add(key)
                i = skip(i)
                assert text[i] == ':'
                i = skip(value(i + 1, path + (key,)))
                if text[i] != ',':
                    break
                i = skip(i + 1)
            assert text[i] == '}'
            i += 1
        elif text[i] == '[':
            i = skip(i + 1)
            n = 0
            while text[i] != ']':
                i = skip(value(i, path + (n,)))
                n += 1
                if text[i] != ',':
                    break
                i = skip(i + 1)
            assert text[i] == ']'
            i += 1
        else:
            _, i = decoder.raw_decode(text, i)
        out[path] = (start, i)
        return i

    assert skip(value(0, ())) == len(text)
    return out


def replace(text, replacements):
    located = spans(text)
    edits = [(located[path], json.dumps(v, ensure_ascii=False)) for path, v in replacements.items()]
    for (start, end), token in sorted(edits, reverse=True):
        text = text[:start] + token + text[end:]
    return text


def masked(text, paths):
    located = spans(text)
    for start, end in sorted((located[path] for path in paths), reverse=True):
        text = text[:start] + '<WIDTH>' + text[end:]
    return text
