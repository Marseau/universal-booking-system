#!/usr/bin/env node

const http = require('http');

const BASE_URL = 'http://localhost:3001';

// Lista de páginas para testar
const pages = [
  // API Endpoints
  { path: '/api/status', type: 'API' },
  { path: '/health', type: 'API' },
  
  // Frontend Pages
  { path: '/landing.html', type: 'Frontend' },
  { path: '/login.html', type: 'Frontend' },
  { path: '/register.html', type: 'Frontend' },
  { path: '/index.html', type: 'Frontend' },
  { path: '/analytics.html', type: 'Frontend' },
  { path: '/appointments.html', type: 'Frontend' },
  { path: '/billing.html', type: 'Frontend' },
  { path: '/customers.html', type: 'Frontend' },
  { path: '/services.html', type: 'Frontend' },
  { path: '/settings.html', type: 'Frontend' },
  { path: '/success.html', type: 'Frontend' },
  
  // Dashboard routes (may redirect or require auth)
  { path: '/admin', type: 'Dashboard' },
  { path: '/billing', type: 'Dashboard' },
];

function testPage(page) {
  return new Promise((resolve) => {
    const url = `${BASE_URL}${page.path}`;
    
    http.get(url, (res) => {
      const { statusCode, headers } = res;
      let data = '';
      
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const result = {
          ...page,
          url,
          status: statusCode,
          success: statusCode >= 200 && statusCode < 400,
          contentType: headers['content-type'] || 'unknown',
          size: data.length,
          title: extractTitle(data),
          hasNavigation: checkNavigation(data)
        };
        resolve(result);
      });
    }).on('error', (err) => {
      resolve({
        ...page,
        url,
        status: 'ERROR',
        success: false,
        error: err.message
      });
    });
  });
}

function extractTitle(html) {
  const match = html.match(/<title>(.*?)<\/title>/i);
  return match ? match[1].trim() : 'No title found';
}

function checkNavigation(html) {
  const navLinks = html.match(/href=["']([^"']+\.html|\/[^"']+)["']/gi) || [];
  return navLinks.length > 0 ? navLinks.length : 0;
}

async function runTests() {
  console.log('🔍 Testando navegação do Universal Booking System');
  console.log('=' .repeat(80));
  
  const results = [];
  
  for (const page of pages) {
    process.stdout.write(`Testando ${page.path}... `);
    const result = await testPage(page);
    results.push(result);
    
    if (result.success) {
      console.log(`✅ ${result.status}`);
    } else {
      console.log(`❌ ${result.status || result.error}`);
    }
  }
  
  console.log('\n📊 RESULTADOS DO TESTE');
  console.log('=' .repeat(80));
  
  // Agrupar por tipo
  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.type]) acc[result.type] = [];
    acc[result.type].push(result);
    return acc;
  }, {});
  
  for (const [type, typeResults] of Object.entries(groupedResults)) {
    console.log(`\n${type.toUpperCase()} PAGES:`);
    
    typeResults.forEach(result => {
      const status = result.success ? '✅' : '❌';
      const statusCode = result.status;
      const title = result.title && result.title.length > 50 
        ? result.title.substring(0, 50) + '...' 
        : result.title;
      
      console.log(`  ${status} ${result.path} (${statusCode})`);
      
      if (result.success && result.title) {
        console.log(`     📄 ${title}`);
      }
      
      if (result.hasNavigation && result.type === 'Frontend') {
        console.log(`     🔗 ${result.hasNavigation} navigation links found`);
      }
      
      if (result.error) {
        console.log(`     ⚠️  ${result.error}`);
      }
    });
  }
  
  // Estatísticas
  const totalPages = results.length;
  const successfulPages = results.filter(r => r.success).length;
  const failedPages = totalPages - successfulPages;
  
  console.log('\n📈 ESTATÍSTICAS:');
  console.log(`  Total de páginas testadas: ${totalPages}`);
  console.log(`  Páginas funcionando: ${successfulPages} ✅`);
  console.log(`  Páginas com erro: ${failedPages} ❌`);
  console.log(`  Taxa de sucesso: ${Math.round((successfulPages/totalPages) * 100)}%`);
  
  // Links de navegação encontrados
  const frontendPages = results.filter(r => r.type === 'Frontend' && r.success);
  const totalNavLinks = frontendPages.reduce((sum, page) => sum + (page.hasNavigation || 0), 0);
  
  if (totalNavLinks > 0) {
    console.log(`  Total de links de navegação: ${totalNavLinks} 🔗`);
  }
  
  console.log('\n🌐 QUICK ACCESS:');
  console.log(`  Landing Page: ${BASE_URL}/landing.html`);
  console.log(`  Admin Login: ${BASE_URL}/login.html`);
  console.log(`  Dashboard: ${BASE_URL}/admin`);
  console.log(`  API Status: ${BASE_URL}/api/status`);
}

// Aguardar um pouco para o servidor estar pronto
setTimeout(() => {
  runTests().catch(console.error);
}, 2000);