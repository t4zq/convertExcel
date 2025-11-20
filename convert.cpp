#include <string>
#include <vector>
#include <sstream>
#include <algorithm>
#include <cctype>
#include <cstring>
#include <cstdlib>
#include <cstdio>

#include <emscripten/emscripten.h>

static inline void trim_inplace(std::string &s) {
  size_t start = 0;
  while (start < s.size() && std::isspace(static_cast<unsigned char>(s[start]))) start++;
  size_t end = s.size();
  while (end > start && std::isspace(static_cast<unsigned char>(s[end - 1]))) end--;
  if (start == 0 && end == s.size()) return;
  s = s.substr(start, end - start);
}

static std::vector<std::string> split_line(const std::string &line) {
  // detect delimiter: tab, comma, otherwise whitespace
  if (line.find('\t') != std::string::npos) {
    std::vector<std::string> out;
    std::string cur;
    for (char c : line) {
      if (c == '\t') { out.push_back(cur); cur.clear(); }
      else { cur.push_back(c); }
    }
    out.push_back(cur);
    return out;
  } else if (line.find(',') != std::string::npos) {
    // simple CSV split without quoted CSV parsing (input is pre-Excel copy)
    std::vector<std::string> out;
    std::string cur;
    for (char c : line) {
      if (c == ',') { out.push_back(cur); cur.clear(); }
      else { cur.push_back(c); }
    }
    out.push_back(cur);
    return out;
  } else {
    // split by contiguous whitespace
    std::vector<std::string> out;
    std::string cur;
    bool inToken = false;
    for (char ch : line) {
      if (std::isspace(static_cast<unsigned char>(ch))) {
        if (inToken) {
          out.push_back(cur);
          cur.clear();
          inToken = false;
        }
      } else {
        cur.push_back(ch);
        inToken = true;
      }
    }
    if (!cur.empty()) out.push_back(cur);
    if (out.empty()) out.push_back("");
    return out;
  }
}

struct Table {
  std::vector<std::vector<std::string>> rows;
  size_t cols = 0;
};

static Table parse_table(const std::string &input) {
  Table t;
  std::string line;
  std::stringstream ss(input);
  while (std::getline(ss, line)) {
    // keep original line for empty check, but trim for processing
    std::string trimmed = line;
    trim_inplace(trimmed);
    if (trimmed.empty()) continue;
    std::vector<std::string> cells = split_line(line);
    for (auto &c : cells) trim_inplace(c);
    t.cols = std::max(t.cols, cells.size());
    t.rows.emplace_back(std::move(cells));
  }
  // pad to same columns
  for (auto &r : t.rows) {
    while (r.size() < t.cols) r.emplace_back("");
  }
  return t;
}

static std::string latex_escape(const std::string &s) {
  std::string out;
  out.reserve(s.size());
  for (char ch : s) {
    switch (ch) {
      case '&': out += "\\&"; break;
      case '%': out += "\\%"; break;
      case '$': out += "\\$"; break;
      case '#': out += "\\#"; break;
      case '_': out += "\\_"; break;
      case '{': out += "\\{"; break;
      case '}': out += "\\}"; break;
      default: out += ch; break;
    }
  }
  return out;
}

static std::string to_latex(const Table &t) {
  if (t.rows.empty() || t.cols == 0) return std::string();
  std::string colfmt("{");
  colfmt.append(t.cols, 'c');
  colfmt.push_back('}');

  std::string out;
  out.reserve(128 * t.rows.size());
  out += "\\begin{tabular}"; out += colfmt; out += "\n\\hline\n";
  for (const auto &row : t.rows) {
    for (size_t j = 0; j < row.size(); ++j) {
      if (j) out += " & ";
      out += latex_escape(row[j]);
    }
    out += " \\\n";
  }
  out += "\\hline\n\\end{tabular}";
  return out;
}

static std::string csv_quote_cell(const std::string &s) {
  bool need = s.find(',') != std::string::npos || s.find('\n') != std::string::npos || s.find('"') != std::string::npos;
  if (!need) return s;
  std::string out; out.reserve(s.size() + 2);
  out.push_back('"');
  for (char ch : s) {
    if (ch == '"') out += "\"\""; else out += ch;
  }
  out.push_back('"');
  return out;
}

static std::string to_csv(const Table &t) {
  std::string out;
  out.reserve(64 * t.rows.size());
  for (size_t i = 0; i < t.rows.size(); ++i) {
    const auto &row = t.rows[i];
    for (size_t j = 0; j < row.size(); ++j) {
      if (j) out.push_back(',');
      out += csv_quote_cell(row[j]);
    }
    if (i + 1 < t.rows.size()) out.push_back('\n');
  }
  return out;
}

static char* dup_cstr(const std::string &s) {
  char *p = (char*)std::malloc(s.size() + 1);
  if (!p) return nullptr;
  std::memcpy(p, s.data(), s.size());
  p[s.size()] = '\0';
  return p;
}

extern "C" {

EMSCRIPTEN_KEEPALIVE
char* gen_latex(const char* input) {
  if (!input) return dup_cstr("");
  Table t = parse_table(std::string(input));
  if (t.rows.empty()) return dup_cstr("");
  std::string lt = to_latex(t);
  return dup_cstr(lt);
}

EMSCRIPTEN_KEEPALIVE
char* gen_csv(const char* input) {
  if (!input) return dup_cstr("");
  Table t = parse_table(std::string(input));
  if (t.rows.empty()) return dup_cstr("");
  std::string cs = to_csv(t);
  return dup_cstr(cs);
}

}
