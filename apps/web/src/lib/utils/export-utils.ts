/**
 * Utilities for exporting calculator results to different formats
 */

import { CalculatorType } from './calculator-storage';

// PDF Export function
export const exportToPdf = async (
  type: CalculatorType,
  data: any,
  fileName: string = 'investment-calculation'
) => {
  try {
    // Dynamically import jsPDF to reduce bundle size
    const { jsPDF } = await import('jspdf');
    // Dynamically import jspdf-autotable for tables
    await import('jspdf-autotable');
    
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(22);
    doc.text('LifeNavigator', 105, 15, { align: 'center' });
    
    doc.setFontSize(18);
    let title = 'Investment Calculation';
    
    switch (type) {
      case CalculatorType.INVESTMENT_GROWTH:
        title = 'Investment Growth Projection';
        break;
      case CalculatorType.ASSET_ALLOCATION:
        title = 'Asset Allocation Recommendation';
        break;
      case CalculatorType.LUMP_SUM_VS_DCA:
        title = 'Lump Sum vs. Dollar Cost Averaging';
        break;
      case CalculatorType.SCENARIO_COMPARISON:
        title = 'Investment Scenario Comparison';
        break;
    }
    
    doc.text(title, 105, 25, { align: 'center' });
    
    // Add date
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 105, 30, { align: 'center' });
    
    // Add content based on calculator type
    switch (type) {
      case CalculatorType.INVESTMENT_GROWTH:
        exportInvestmentGrowthToPdf(doc, data);
        break;
      case CalculatorType.ASSET_ALLOCATION:
        exportAssetAllocationToPdf(doc, data);
        break;
      case CalculatorType.LUMP_SUM_VS_DCA:
        exportLumpSumVsDcaToPdf(doc, data);
        break;
      case CalculatorType.SCENARIO_COMPARISON:
        exportScenarioComparisonToPdf(doc, data);
        break;
    }
    
    // Add footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(10);
      doc.setTextColor(150);
      doc.text(
        'Generated with LifeNavigator',
        105,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      );
    }
    
    // Save the PDF
    doc.save(`${fileName}.pdf`);
    
    return true;
  } catch (error) {
    console.error('Error exporting to PDF:', error);
    return false;
  }
};

// CSV Export function
export const exportToCsv = (
  type: CalculatorType,
  data: any,
  fileName: string = 'investment-calculation'
) => {
  try {
    let csvContent = '';
    
    // Generate CSV content based on calculator type
    switch (type) {
      case CalculatorType.INVESTMENT_GROWTH:
        csvContent = generateInvestmentGrowthCsv(data);
        break;
      case CalculatorType.ASSET_ALLOCATION:
        csvContent = generateAssetAllocationCsv(data);
        break;
      case CalculatorType.LUMP_SUM_VS_DCA:
        csvContent = generateLumpSumVsDcaCsv(data);
        break;
      case CalculatorType.SCENARIO_COMPARISON:
        csvContent = generateScenarioComparisonCsv(data);
        break;
    }
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${fileName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    return true;
  } catch (error) {
    console.error('Error exporting to CSV:', error);
    return false;
  }
};

// Helper function to format currency
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

// Helper function to format percentage
const formatPercent = (value: number) => {
  return `${value.toFixed(2)}%`;
};

// Investment Growth PDF export
const exportInvestmentGrowthToPdf = (doc: any, data: any) => {
  const { summary, scenario, annual_projection } = data;
  
  // Add parameters section
  doc.setFontSize(14);
  doc.text('Investment Parameters', 14, 40);
  
  doc.setFontSize(10);
  doc.text(`Initial Investment: ${formatCurrency(scenario.initial_investment)}`, 14, 50);
  doc.text(`Annual Return Rate: ${formatPercent(scenario.annual_return_rate)}`, 14, 55);
  doc.text(`Time Horizon: ${scenario.time_horizon_years} years`, 14, 60);
  doc.text(`Inflation Rate: ${formatPercent(scenario.inflation_rate)}`, 14, 65);
  
  if (scenario.contribution_amount) {
    doc.text(`Contribution: ${formatCurrency(scenario.contribution_amount)} per ${scenario.contribution_frequency}`, 14, 70);
    if (scenario.contribution_growth_rate) {
      doc.text(`Contribution Growth Rate: ${formatPercent(scenario.contribution_growth_rate)}`, 14, 75);
    }
  }
  
  // Add summary section
  doc.setFontSize(14);
  doc.text('Investment Summary', 14, 85);
  
  doc.setFontSize(10);
  doc.text(`Final Balance: ${formatCurrency(summary.final_balance)}`, 14, 95);
  doc.text(`Total Contributions: ${formatCurrency(summary.total_contributions)}`, 14, 100);
  doc.text(`Investment Growth: ${formatCurrency(summary.investment_growth)}`, 14, 105);
  doc.text(`Compound Annual Growth Rate: ${formatPercent(summary.compound_annual_growth_rate)}`, 14, 110);
  doc.text(`Inflation-Adjusted Balance: ${formatCurrency(summary.inflation_adjusted_balance)}`, 14, 115);
  
  // Add annual projection table
  doc.setFontSize(14);
  doc.text('Annual Projection', 14, 130);
  
  // Create table data
  const tableColumn = ["Year", "Balance", "Contribution", "Growth", "Inflation-Adjusted"];
  const tableRows = annual_projection.map((year: any) => [
    year.year,
    formatCurrency(year.balance),
    formatCurrency(year.contribution),
    formatCurrency(year.growth),
    formatCurrency(year.inflation_adjusted_balance)
  ]);
  
  // @ts-ignore - autotable is added by the imported plugin
  doc.autoTable({
    startY: 135,
    head: [tableColumn],
    body: tableRows,
    didDrawPage: function (data: any) {
      doc.text('Annual Projection', 14, 15);
    }
  });
};

// Asset Allocation PDF export
const exportAssetAllocationToPdf = (doc: any, data: any) => {
  const { allocation, portfolio, asset_class_metrics } = data;
  
  // Add allocation section
  doc.setFontSize(14);
  doc.text('Asset Allocation', 14, 40);
  
  // Create pie chart data
  let yPosition = 50;
  
  Object.entries(allocation).forEach(([asset, percentage]: [string, any]) => {
    if (percentage > 0) {
      doc.setFontSize(10);
      doc.text(`${asset.charAt(0).toUpperCase() + asset.slice(1)}: ${formatPercent(percentage)}`, 14, yPosition);
      yPosition += 5;
    }
  });
  
  // Add portfolio metrics
  yPosition += 10;
  doc.setFontSize(14);
  doc.text('Portfolio Metrics', 14, yPosition);
  
  yPosition += 10;
  doc.setFontSize(10);
  doc.text(`Expected Return: ${formatPercent(portfolio.expected_return)}`, 14, yPosition);
  yPosition += 5;
  doc.text(`Volatility: ${formatPercent(portfolio.volatility)}`, 14, yPosition);
  yPosition += 5;
  doc.text(`Sharpe Ratio: ${portfolio.sharpe_ratio.toFixed(2)}`, 14, yPosition);
  yPosition += 5;
  doc.text(`Risk Level: ${portfolio.risk_level}`, 14, yPosition);
  
  // Add asset class metrics table
  yPosition += 15;
  doc.setFontSize(14);
  doc.text('Asset Class Metrics', 14, yPosition);
  
  // Create table data
  const tableColumn = ["Asset Class", "Allocation", "Expected Return", "Volatility", "Best Year", "Worst Year"];
  const tableRows = Object.entries(asset_class_metrics).map(([assetClass, metrics]: [string, any]) => [
    assetClass.charAt(0).toUpperCase() + assetClass.slice(1),
    formatPercent(metrics.allocation_percentage),
    formatPercent(metrics.expected_return),
    formatPercent(metrics.volatility),
    formatPercent(metrics.best_year),
    formatPercent(metrics.worst_year)
  ]);
  
  // @ts-ignore - autotable is added by the imported plugin
  doc.autoTable({
    startY: yPosition + 5,
    head: [tableColumn],
    body: tableRows,
  });
};

// Lump Sum vs DCA PDF export
const exportLumpSumVsDcaToPdf = (doc: any, data: any) => {
  const { comparison, lump_sum, dollar_cost_averaging, partial_lump_sum_dca } = data;
  
  // Add comparison section
  doc.setFontSize(14);
  doc.text('Investment Strategy Comparison', 14, 40);
  
  doc.setFontSize(10);
  doc.text(`Total Amount: ${formatCurrency(data.total_amount)}`, 14, 50);
  doc.text(`Time Horizon: ${data.time_horizon_years} years`, 14, 55);
  doc.text(`Expected Annual Return: ${formatPercent(data.expected_annual_return)}`, 14, 60);
  doc.text(`Best Strategy: ${comparison.best_strategy}`, 14, 65);
  
  // Create table data
  const tableColumn = ["Strategy", "Final Balance", "Growth Amount", "Growth Percentage"];
  const tableRows = [
    [
      "Lump Sum",
      formatCurrency(lump_sum.final_balance),
      formatCurrency(lump_sum.growth_amount),
      formatPercent(lump_sum.growth_percentage)
    ],
    [
      "Dollar Cost Averaging",
      formatCurrency(dollar_cost_averaging.final_balance),
      formatCurrency(dollar_cost_averaging.growth_amount),
      formatPercent(dollar_cost_averaging.growth_percentage)
    ],
    [
      "Partial Lump Sum + DCA",
      formatCurrency(partial_lump_sum_dca.final_balance),
      formatCurrency(partial_lump_sum_dca.growth_amount),
      formatPercent(partial_lump_sum_dca.growth_percentage)
    ]
  ];
  
  // @ts-ignore - autotable is added by the imported plugin
  doc.autoTable({
    startY: 75,
    head: [tableColumn],
    body: tableRows,
  });
  
  // Add strategy recommendation
  doc.setFontSize(14);
  doc.text('Strategy Recommendation', 14, 130);
  
  doc.setFontSize(10);
  const recommendation = data.strategy_recommendation;
  
  // Split the recommendation into lines if it's too long
  const maxWidth = 180;
  const fontSize = 10;
  const charWidth = fontSize / 2.83; // Approximate width of a character
  const maxChars = Math.floor(maxWidth / charWidth);
  
  let lines = [];
  if (recommendation.length > maxChars) {
    let currentLine = '';
    for (const word of recommendation.split(' ')) {
      if (currentLine.length + word.length + 1 <= maxChars) {
        currentLine += (currentLine.length === 0 ? '' : ' ') + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine.length > 0) {
      lines.push(currentLine);
    }
  } else {
    lines = [recommendation];
  }
  
  // Add each line of the recommendation
  let yPosition = 140;
  for (const line of lines) {
    doc.text(line, 14, yPosition);
    yPosition += 6;
  }
};

// Scenario Comparison PDF export
const exportScenarioComparisonToPdf = (doc: any, data: any) => {
  const { scenarios, best_performing, recommendation } = data;
  
  // Add comparison section
  doc.setFontSize(14);
  doc.text('Scenario Comparison', 14, 40);
  
  doc.setFontSize(10);
  doc.text(`Best for Final Balance: ${best_performing.by_final_balance}`, 14, 50);
  doc.text(`Best for Inflation-Adjusted: ${best_performing.by_inflation_adjusted}`, 14, 55);
  doc.text(`Best for CAGR: ${best_performing.by_cagr}`, 14, 60);
  
  // Create table data
  const tableColumn = ["Scenario", "Final Balance", "Inflation-Adjusted", "CAGR", "Total Contributions"];
  const tableRows = scenarios.map((scenario: any) => [
    scenario.name,
    formatCurrency(scenario.final_balance),
    formatCurrency(scenario.inflation_adjusted_balance),
    formatPercent(scenario.compound_annual_growth_rate),
    formatCurrency(scenario.total_contributions)
  ]);
  
  // @ts-ignore - autotable is added by the imported plugin
  doc.autoTable({
    startY: 70,
    head: [tableColumn],
    body: tableRows,
  });
  
  // Add recommendation
  doc.setFontSize(14);
  doc.text('Recommendation', 14, 130);
  
  doc.setFontSize(10);
  doc.text(recommendation, 14, 140);
};

// Generate Investment Growth CSV
const generateInvestmentGrowthCsv = (data: any) => {
  const { summary, scenario, annual_projection } = data;
  
  let csvContent = 'Investment Growth Projection\n\n';
  
  // Add parameters
  csvContent += 'Investment Parameters\n';
  csvContent += `Initial Investment,${scenario.initial_investment}\n`;
  csvContent += `Annual Return Rate,${scenario.annual_return_rate}%\n`;
  csvContent += `Time Horizon,${scenario.time_horizon_years} years\n`;
  csvContent += `Inflation Rate,${scenario.inflation_rate}%\n`;
  
  if (scenario.contribution_amount) {
    csvContent += `Contribution,${scenario.contribution_amount} per ${scenario.contribution_frequency}\n`;
    if (scenario.contribution_growth_rate) {
      csvContent += `Contribution Growth Rate,${scenario.contribution_growth_rate}%\n`;
    }
  }
  
  // Add summary
  csvContent += '\nInvestment Summary\n';
  csvContent += `Final Balance,${summary.final_balance}\n`;
  csvContent += `Total Contributions,${summary.total_contributions}\n`;
  csvContent += `Investment Growth,${summary.investment_growth}\n`;
  csvContent += `Compound Annual Growth Rate,${summary.compound_annual_growth_rate}%\n`;
  csvContent += `Inflation-Adjusted Balance,${summary.inflation_adjusted_balance}\n\n`;
  
  // Add annual projection
  csvContent += 'Annual Projection\n';
  csvContent += 'Year,Balance,Contribution,Growth,Inflation-Adjusted\n';
  
  annual_projection.forEach((year: any) => {
    csvContent += `${year.year},${year.balance},${year.contribution},${year.growth},${year.inflation_adjusted_balance}\n`;
  });
  
  return csvContent;
};

// Generate Asset Allocation CSV
const generateAssetAllocationCsv = (data: any) => {
  const { allocation, portfolio, asset_class_metrics } = data;
  
  let csvContent = 'Asset Allocation Recommendation\n\n';
  
  // Add allocation
  csvContent += 'Asset Allocation\n';
  Object.entries(allocation).forEach(([asset, percentage]: [string, any]) => {
    if (percentage > 0) {
      csvContent += `${asset.charAt(0).toUpperCase() + asset.slice(1)},${percentage}%\n`;
    }
  });
  
  // Add portfolio metrics
  csvContent += '\nPortfolio Metrics\n';
  csvContent += `Expected Return,${portfolio.expected_return}%\n`;
  csvContent += `Volatility,${portfolio.volatility}%\n`;
  csvContent += `Sharpe Ratio,${portfolio.sharpe_ratio}\n`;
  csvContent += `Risk Level,${portfolio.risk_level}\n\n`;
  
  // Add asset class metrics
  csvContent += 'Asset Class Metrics\n';
  csvContent += 'Asset Class,Allocation,Expected Return,Volatility,Best Year,Worst Year\n';
  
  Object.entries(asset_class_metrics).forEach(([assetClass, metrics]: [string, any]) => {
    csvContent += `${assetClass.charAt(0).toUpperCase() + assetClass.slice(1)},${metrics.allocation_percentage}%,${metrics.expected_return}%,${metrics.volatility}%,${metrics.best_year}%,${metrics.worst_year}%\n`;
  });
  
  return csvContent;
};

// Generate Lump Sum vs DCA CSV
const generateLumpSumVsDcaCsv = (data: any) => {
  const { comparison, lump_sum, dollar_cost_averaging, partial_lump_sum_dca } = data;
  
  let csvContent = 'Lump Sum vs Dollar Cost Averaging\n\n';
  
  // Add parameters
  csvContent += 'Parameters\n';
  csvContent += `Total Amount,${data.total_amount}\n`;
  csvContent += `Time Horizon,${data.time_horizon_years} years\n`;
  csvContent += `Expected Annual Return,${data.expected_annual_return}%\n`;
  csvContent += `Best Strategy,${comparison.best_strategy}\n\n`;
  
  // Add comparison
  csvContent += 'Strategy Comparison\n';
  csvContent += 'Strategy,Final Balance,Growth Amount,Growth Percentage\n';
  csvContent += `Lump Sum,${lump_sum.final_balance},${lump_sum.growth_amount},${lump_sum.growth_percentage}%\n`;
  csvContent += `Dollar Cost Averaging,${dollar_cost_averaging.final_balance},${dollar_cost_averaging.growth_amount},${dollar_cost_averaging.growth_percentage}%\n`;
  csvContent += `Partial Lump Sum + DCA,${partial_lump_sum_dca.final_balance},${partial_lump_sum_dca.growth_amount},${partial_lump_sum_dca.growth_percentage}%\n\n`;
  
  // Add recommendation
  csvContent += 'Recommendation\n';
  csvContent += `${data.strategy_recommendation}\n`;
  
  return csvContent;
};

// Generate Scenario Comparison CSV
const generateScenarioComparisonCsv = (data: any) => {
  const { scenarios, best_performing, recommendation } = data;
  
  let csvContent = 'Investment Scenario Comparison\n\n';
  
  // Add best performing
  csvContent += 'Best Performing\n';
  csvContent += `Best for Final Balance,${best_performing.by_final_balance}\n`;
  csvContent += `Best for Inflation-Adjusted,${best_performing.by_inflation_adjusted}\n`;
  csvContent += `Best for CAGR,${best_performing.by_cagr}\n\n`;
  
  // Add scenarios
  csvContent += 'Scenarios\n';
  csvContent += 'Scenario,Final Balance,Inflation-Adjusted,CAGR,Total Contributions\n';
  
  scenarios.forEach((scenario: any) => {
    csvContent += `${scenario.name},${scenario.final_balance},${scenario.inflation_adjusted_balance},${scenario.compound_annual_growth_rate}%,${scenario.total_contributions}\n`;
  });
  
  // Add recommendation
  csvContent += '\nRecommendation\n';
  csvContent += `${recommendation}\n`;
  
  return csvContent;
};