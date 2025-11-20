#include <string>
#include <vector>
#include <sstream>
#include <algorithm>
#include <cctype>
#include <cstring>
#include <cstdlib>
#include <emscripten/emscripten.h>

void trim(std::string &s) {
  auto start = s.find_first_not_of(" \t\r\n");
  auto end = s.find_last_not_of(" \t\r\n");
  s = (start == std::string::npos) ? "" : s.substr(start, end - start + 1);
}

std::vector<std::string> split(const std::string &line) {
  std::vector<std::string> out;
  std::string cur;
  char delim = line.find('\t') != std::string::npos ? '\t' : ',';
  for (char c : line) {
    if (c == delim) { out.push_back(cur); cur.clear(); }
    else cur += c;
  }
  out.push_back(cur);
  return out;
}

typedef std::vector<std::vector<std::string>> Table;

Table parse(const std::string &input) {
  Table t;
  std::stringstream ss(input);
  std::string line;
  while (std::getline(ss, line)) {
    trim(line);
    if (line.empty()) continue;
    auto cells = split(line);
    for (auto &c : cells) trim(c);
    t.push_back(cells);
  }
  return t;
}

std::string escape(const std::string &s) {
  std::string out;
  for (char c : s) {
    if (c == '&' || c == '%' || c == '$' || c == '#' || c == '_' || c == '{' || c == '}') out += '\\';
    out += c;
  }
  return out;
}

std::string to_latex(const Table &t) {
  if (t.empty()) return "";
  std::string out = "\\begin{tabular}{" + std::string(t[0].size(), 'c') + "}\n\\hline\n";
  for (const auto &row : t) {
    for (size_t i = 0; i < row.size(); ++i) {
      if (i) out += " & ";
      out += escape(row[i]);
    }
    out += " \\\\\n";
  }
  return out + "\\hline\n\\end{tabular}";
}

std::string to_csv(const Table &t) {
  std::string out;
  for (size_t i = 0; i < t.size(); ++i) {
    for (size_t j = 0; j < t[i].size(); ++j) {
      if (j) out += ',';
      out += t[i][j];
    }
    if (i + 1 < t.size()) out += '\n';
  }
  return out;
}

char* dup(const std::string &s) {
  char *p = (char*)malloc(s.size() + 1);
  memcpy(p, s.c_str(), s.size() + 1);
  return p;
}

extern "C" {
EMSCRIPTEN_KEEPALIVE char* gen_latex(const char* in) {
  return in ? dup(to_latex(parse(in))) : dup("");
}
EMSCRIPTEN_KEEPALIVE char* gen_csv(const char* in) {
  return in ? dup(to_csv(parse(in))) : dup("");
}
}
