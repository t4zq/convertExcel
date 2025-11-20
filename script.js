const input = document.getElementById('input');
const latex = document.getElementById('latex');
const csv = document.getElementById('csv');

ConvertModule().then(M => {
  const call = (ptr) => { const s = M.UTF8ToString(ptr); M._free(ptr); return s; };
  const genLatex = M.cwrap('gen_latex', 'number', ['string']);
  const genCsv = M.cwrap('gen_csv', 'number', ['string']);
  
  document.getElementById('latex-btn').onclick = () => {
    const data = input.value.trim();
    if (data) latex.value = call(genLatex(data));
  };
  
  document.getElementById('csv-btn').onclick = () => {
    const data = input.value.trim();
    if (data) csv.value = call(genCsv(data));
  };
});