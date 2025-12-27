#include <string>
#include <vector>
#include <sstream>
#include <algorithm>
#include <cctype>
#include <cstring>
#include <cstdlib>
#include <cmath>
#include <emscripten/emscripten.h>

void trim(std::string &s) {
  auto start = s.find_first_not_of(" \t\r\n");
  auto end = s.find_last_not_of(" \t\r\n");
  s = (start == std::string::npos) ? "" : s.substr(start, end - start + 1);
}

bool is_number(const std::string &s) {
  if (s.empty()) return false;
  size_t start = (s[0] == '-' || s[0] == '+') ? 1 : 0;
  if (start >= s.size()) return false;
  bool has_dot = false;
  for (size_t i = start; i < s.size(); ++i) {
    if (s[i] == '.') {
      if (has_dot) return false;
      has_dot = true;
    } else if (!isdigit(s[i])) {
      return false;
    }
  }
  return true;
}

std::string round_number(const std::string &s, int decimals) {
  if (!is_number(s)) return s;
  if (decimals < 0) decimals = 0;
  
  double value = std::stod(s);
  double multiplier = std::pow(10.0, decimals);
  double rounded = std::round(value * multiplier) / multiplier;
  
  std::ostringstream oss;
  oss.precision(decimals);
  oss << std::fixed << rounded;
  return oss.str();
}

std::string round_significant_figures(const std::string &s, int sig_figs) {
  if (!is_number(s)) return s;
  if (sig_figs <= 0) sig_figs = 1;
  
  double value = std::stod(s);
  if (value == 0.0) return "0";
  
  double abs_value = std::abs(value);
  int exponent = std::floor(std::log10(abs_value));
  double multiplier = std::pow(10.0, sig_figs - 1 - exponent);
  double rounded = std::round(value * multiplier) / multiplier;
  
  // 整数として表示する必要があるか判定
  int decimal_places = std::max(0, sig_figs - 1 - exponent);
  
  std::ostringstream oss;
  if (decimal_places > 0) {
    oss.precision(decimal_places);
    oss << std::fixed << rounded;
  } else {
    oss << std::fixed << rounded;
    std::string result = oss.str();
    // 小数点以下の0を削除
    size_t dot_pos = result.find('.');
    if (dot_pos != std::string::npos) {
      result = result.substr(0, dot_pos);
    }
    return result;
  }
  return oss.str();
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

std::string to_latex_rounded(const Table &t, int decimals) {
  if (t.empty()) return "";
  std::string out = "\\begin{tabular}{" + std::string(t[0].size(), 'c') + "}\n\\hline\n";
  for (const auto &row : t) {
    for (size_t i = 0; i < row.size(); ++i) {
      if (i) out += " & ";
      std::string cell = round_number(row[i], decimals);
      out += escape(cell);
    }
    out += " \\\\\n";
  }
  return out + "\\hline\n\\end{tabular}";
}

std::string to_latex_sig_figs(const Table &t, int sig_figs) {
  if (t.empty()) return "";
  std::string out = "\\begin{tabular}{" + std::string(t[0].size(), 'c') + "}\n\\hline\n";
  for (const auto &row : t) {
    for (size_t i = 0; i < row.size(); ++i) {
      if (i) out += " & ";
      std::string cell = round_significant_figures(row[i], sig_figs);
      out += escape(cell);
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

std::string to_tikz_graph(const Table &t, const std::string &filename, int sig_figs, const std::string &legend_pos, const std::string &scale_mode) {
  if (t.empty()) return "";
  
  size_t num_cols = t[0].size();
  if (num_cols < 2) return ""; // 少なくとも2列必要（x軸とy軸）
  if (sig_figs < 1) sig_figs = 3;
  
  // データの最小値・最大値を計算
  double x_min = 1e100, x_max = -1e100;
  double y_min = 1e100, y_max = -1e100;
  
  for (const auto &row : t) {
    if (row.size() >= 2) {
      // x軸データ（第1列）
      if (is_number(row[0])) {
        double x_val = std::stod(row[0]);
        x_min = std::min(x_min, x_val);
        x_max = std::max(x_max, x_val);
      }
      // y軸データ（第2列以降）
      for (size_t i = 1; i < row.size(); ++i) {
        if (is_number(row[i])) {
          double y_val = std::stod(row[i]);
          y_min = std::min(y_min, y_val);
          y_max = std::max(y_max, y_val);
        }
      }
    }
  }
  
  // ガウス記号を適用
  int xmin_val = (int)std::floor(x_min);
  int xmax_val = (int)std::floor(x_max) + 1;
  int ymin_val = (int)std::floor(y_min);
  int ymax_val = (int)std::floor(y_max) + 1;
  
  std::string out = "\\begin{figure}[H]\n";
  out += "    \\centering\n";
  out += "    \\begin{tikzpicture}\n";
  out += "        \\begin{axis}[\n";
  out += "            width=0.8\\textwidth,\n";
  out += "            height=0.6\\textwidth,\n";
  out += "            minor tick num=1,\n";
  out += "            tick style={major tick length=5pt, minor tick length=3pt, tick pos=both, color=black, line width=0.5pt},\n";
  out += "            tick align=inside,\n";
  out += "            xmajorgrids=false,\n";
  out += "            ymajorgrids=false,\n";
  out += "            xminorgrids=false,\n";
  out += "            yminorgrids=false,\n";
  out += "            axis line style={-},\n";
  out += "            scaled ticks=false,\n";
  out += "            xticklabel style={/pgf/number format/fixed},\n";
  out += "            yticklabel style={/pgf/number format/fixed},\n";
  out += "            xticklabel style = {/pgf/number format/precision=\"";
  out += std::to_string(sig_figs);
  out += "\"},\n";
  out += "            yticklabel style = {/pgf/number format/precision=\"";
  out += std::to_string(sig_figs);
  out += "\"},\n";
  out += "            legend cell align = {left},\n";
  out += "            legend pos = ";
  out += legend_pos;
  out += ",\n";
  
  // スケールモードを設定
  if (scale_mode == "semilog") {
    out += "            ymode=log,\n";
  } else if (scale_mode == "loglog") {
    out += "            xmode=log,\n";
    out += "            ymode=log,\n";
  }
  
  out += "            xlabel={x軸},\n";
  out += "            ylabel={y軸},\n";
  out += "            xmin=";
  out += std::to_string(xmin_val);
  out += ", xmax=";
  out += std::to_string(xmax_val);
  out += ",\n";
  out += "            ymin=";
  out += std::to_string(ymin_val);
  out += ", ymax=";
  out += std::to_string(ymax_val);
  out += ",\n";
  
  // (max-min)/5刻みで目盛りを設定
  int x_step = (xmax_val - xmin_val) / 5;
  int y_step = (ymax_val - ymin_val) / 5;
  if (x_step < 1) x_step = 1;
  if (y_step < 1) y_step = 1;
  
  out += "            xtick={";
  for (int i = xmin_val; i <= xmax_val; i += x_step) {
    if (i != xmin_val) out += ",";
    out += std::to_string(i);
  }
  out += "},\n";
  
  out += "            ytick={";
  for (int i = ymin_val; i <= ymax_val; i += y_step) {
    if (i != ymin_val) out += ",";
    out += std::to_string(i);
  }
  out += "}\n";
  out += "        ]\n";
  
  // 各y列に対してaddplotを生成（列1がx軸、列2以降がy軸）
  for (size_t i = 1; i < num_cols; ++i) {
    out += "            \\addplot [smooth, mark=*, draw] table [col sep=comma, x index=0, y index=";
    out += std::to_string(i);
    out += "] {";
    out += filename;
    out += ".csv};\n";
    out += "            \\addlegendentry{凡例";
    out += std::to_string(i);
    out += "}\n";
  }
  
  out += "        \\end{axis}\n";
  out += "    \\end{tikzpicture}\n";
  out += "    \\caption{図題}\n";
  out += "    \\label{fig:label}\n";
  out += "\\end{figure}\n";
  
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
EMSCRIPTEN_KEEPALIVE char* gen_latex_rounded(const char* in, int decimals) {
  return in ? dup(to_latex_rounded(parse(in), decimals)) : dup("");
}
EMSCRIPTEN_KEEPALIVE char* gen_latex_sig_figs(const char* in, int sig_figs) {
  return in ? dup(to_latex_sig_figs(parse(in), sig_figs)) : dup("");
}
EMSCRIPTEN_KEEPALIVE char* gen_tikz_graph(const char* in, const char* filename, int sig_figs, const char* legend_pos, const char* scale_mode) {
  if (!in || !filename) return dup("");
  std::string lp = legend_pos ? legend_pos : "north west";
  std::string sm = scale_mode ? scale_mode : "linear";
  return dup(to_tikz_graph(parse(in), filename, sig_figs, lp, sm));
}
}
