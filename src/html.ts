export const indexHtml = `
<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Overpriseed - Exposing Overpriced Startup Deals</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
    <script defer src="https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js"></script>
    <style>
        [x-cloak] { display: none !important; }
    </style>
    <script>
        tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    colors: {
                        'forum-bg': '#0a0a0a',
                        'forum-card': '#1a1a1a',
                        'forum-border': '#2a2a2a',
                        'forum-text': '#e0e0e0',
                        'forum-accent': '#ff4444',
                    }
                }
            }
        }
    </script>
</head>
<body class="bg-forum-bg text-forum-text min-h-screen">
    <div x-data="app()" x-init="fetchDeals()">
        <!-- Header -->
        <header class="border-b border-forum-border sticky top-0 bg-forum-bg/95 backdrop-blur-sm z-50">
            <div class="max-w-6xl mx-auto px-4 py-4">
                <div class="flex items-center justify-between">
                    <div>
                        <h1 class="text-2xl font-bold text-forum-accent">💸 Overpriseed</h1>
                        <p class="text-sm text-gray-500">Exposing overvalued startup deals</p>
                    </div>
                    <nav class="flex gap-6 items-center">
                        <a href="#" @click.prevent="currentView = 'deals'"
                           :class="currentView === 'deals' ? 'text-forum-accent' : 'text-forum-text hover:text-forum-accent'"
                           class="font-medium transition-colors">Deals</a>
                        <a href="#" @click.prevent="currentView = 'bubble'"
                           :class="currentView === 'bubble' ? 'text-forum-accent' : 'text-forum-text hover:text-forum-accent'"
                           class="font-medium transition-colors">Bubble</a>
                        <a href="#" @click.prevent="currentView = 'challenges'"
                           :class="currentView === 'challenges' ? 'text-forum-accent' : 'text-forum-text hover:text-forum-accent'"
                           class="font-medium transition-colors">Challenges</a>
                        <a href="#" @click.prevent="currentView = 'leaderboard'" 
                           :class="currentView === 'leaderboard' ? 'text-forum-accent' : 'text-forum-text hover:text-forum-accent'" 
                           class="font-medium transition-colors">Leaderboard</a>
                        <a href="/feed.xml" target="_blank"
                           class="text-orange-500 hover:text-orange-400 transition-colors" title="RSS Feed">
                           <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                             <circle cx="6.18" cy="17.82" r="2.18"/>
                             <path d="M4 4.44v2.83c7.03 0 12.73 5.7 12.73 12.73h2.83c0-8.59-6.97-15.56-15.56-15.56zm0 5.66v2.83c3.9 0 7.07 3.17 7.07 7.07h2.83c0-5.47-4.43-9.9-9.9-9.9z"/>
                           </svg>
                        </a>
                    </nav>
                </div>
            </div>
        </header>

        <!-- Main Content -->
        <main class="max-w-6xl mx-auto px-4 py-8">
            <!-- Deals View -->
            <div x-show="currentView === 'deals'" x-cloak>
                <!-- Search and Filter -->
                <div class="mb-6 flex flex-col sm:flex-row gap-4">
                    <div class="flex-1">
                        <input type="text" 
                               x-model="searchQuery" 
                               placeholder="Search companies..." 
                               class="w-full bg-forum-card border border-forum-border rounded-lg px-4 py-2 text-forum-text placeholder-gray-500 focus:outline-none focus:border-forum-accent/50">
                    </div>
                    <div class="flex gap-2">
                        <select x-model="roundFilter" 
                                class="bg-forum-card border border-forum-border rounded-lg px-4 py-2 text-forum-text focus:outline-none focus:border-forum-accent/50">
                            <option value="">All Rounds</option>
                            <option value="Pre-Seed">Pre-Seed</option>
                            <option value="Seed">Seed</option>
                            <option value="Series A">Series A</option>
                            <option value="Series B">Series B</option>
                            <option value="Series C">Series C+</option>
                        </select>
                        <select x-model="sortBy" 
                                class="bg-forum-card border border-forum-border rounded-lg px-4 py-2 text-forum-text focus:outline-none focus:border-forum-accent/50">
                            <option value="date">Newest</option>
                            <option value="amount_desc">Highest $</option>
                            <option value="amount_asc">Lowest $</option>
                        </select>
                    </div>
                </div>

                <!-- Stats Panel -->
                <div x-show="!loading && deals.length > 0" class="grid grid-cols-3 gap-4 mb-6">
                    <div class="bg-forum-card border border-forum-border rounded-lg p-4 text-center">
                        <p class="text-3xl font-bold text-forum-accent" x-text="deals.length"></p>
                        <p class="text-sm text-gray-500 mt-1">Total Deals</p>
                    </div>
                    <div class="bg-forum-card border border-forum-border rounded-lg p-4 text-center">
                        <p class="text-3xl font-bold text-green-400" x-text="'$' + formatNumber(totalFunding())"></p>
                        <p class="text-sm text-gray-500 mt-1">Total Funding</p>
                    </div>
                    <div class="bg-forum-card border border-forum-border rounded-lg p-4 text-center">
                        <p class="text-3xl font-bold text-blue-400" x-text="dealsThisWeek()"></p>
                        <p class="text-sm text-gray-500 mt-1">This Week</p>
                    </div>
                </div>

                <!-- Charts Grid -->
                <div x-show="!loading && deals.length > 0" x-init="$watch('deals', () => { renderFundingChart(); renderRoundChart(); })" class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
                    <!-- Funding Trend Chart -->
                    <div class="lg:col-span-2 bg-forum-card border border-forum-border rounded-lg p-4">
                        <h3 class="text-sm font-medium text-gray-400 mb-3">📈 Monthly Funding Trend</h3>
                        <div class="h-48">
                            <canvas id="fundingChart"></canvas>
                        </div>
                    </div>
                    <!-- Round Distribution Chart -->
                    <div class="bg-forum-card border border-forum-border rounded-lg p-4">
                        <h3 class="text-sm font-medium text-gray-400 mb-3">🎯 Round Distribution</h3>
                        <div class="h-48">
                            <canvas id="roundChart"></canvas>
                        </div>
                    </div>
                </div>

                <div class="mb-6">
                    <h2 class="text-xl font-semibold mb-2">Recent Overpriced Deals</h2>
                    <p class="text-gray-500">Community-sourced questionable valuations</p>
                </div>

                <!-- Loading State -->
                <div x-show="loading" class="text-center py-12">
                    <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-forum-accent"></div>
                    <p class="mt-2 text-gray-500">Loading deals...</p>
                </div>

                <!-- Error State -->
                <div x-show="error" x-cloak class="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-4">
                    <p class="text-red-400" x-text="error"></p>
                </div>

                <!-- Deals List -->
                <div x-show="!loading && !error" class="space-y-4">
                    <!-- Filter Results Count -->
                    <p x-show="searchQuery || roundFilter" class="text-sm text-gray-500 mb-2">
                        Showing <span class="text-forum-accent" x-text="filteredDeals.length"></span> of <span x-text="deals.length"></span> deals
                    </p>
                    <template x-for="deal in filteredDeals" :key="deal.id">
                        <div @click="openDealModal(deal)" class="bg-forum-card border border-forum-border rounded-lg p-6 hover:border-forum-accent/50 transition-all cursor-pointer">
                            <div class="flex items-start justify-between mb-3">
                                <div>
                                    <h3 class="text-lg font-semibold text-white" x-text="deal.company"></h3>
                                    <div class="flex items-center gap-3 mt-1 text-sm text-gray-500">
                                        <span x-text="deal.round"></span>
                                        <span>•</span>
                                        <span class="text-forum-accent font-medium" x-text="'$' + formatNumber(deal.amount_usd)"></span>
                                    </div>
                                </div>
                                <span class="text-xs text-gray-600" x-text="formatDate(deal.created_at)"></span>
                            </div>
                            <div class="flex items-center gap-4 text-sm">
                                <a :href="deal.source_url" target="_blank" @click.stop class="text-blue-400 hover:text-blue-300 transition-colors">
                                    Source →
                                </a>
                                <button @click.stop="openDealModal(deal)" class="text-gray-500 hover:text-forum-accent transition-colors">
                                    View Analysis
                                </button>
                            </div>
                        </div>
                    </template>

                    <!-- Empty State -->
                    <div x-show="filteredDeals.length === 0 && deals.length > 0" class="text-center py-12 text-gray-500">
                        <p>No deals match your filters. Try adjusting your search.</p>
                    </div>
                    <div x-show="deals.length === 0" class="text-center py-12 text-gray-500">
                        <p>No deals found. Be the first to submit one!</p>
                    </div>
                </div>
            </div>

            <!-- Bubble Monitor View -->
            <div x-show="currentView === 'bubble'" x-cloak>
                <div class="mb-6">
                    <h2 class="text-xl font-semibold mb-2">AI 泡沫监控</h2>
                    <p class="text-gray-500">基于融资数据的 AI 行业泡沫风险评估</p>
                </div>

                <!-- Summary Stats -->
                <div x-show="deals.length > 0" class="grid grid-cols-3 gap-4 mb-6">
                    <div class="bg-forum-card border border-forum-border rounded-lg p-4 text-center">
                        <p class="text-3xl font-bold text-red-400" x-text="bubbleCards.filter(c => c.health === '投机融资').length"></p>
                        <p class="text-sm text-gray-500 mt-1">投机融资</p>
                    </div>
                    <div class="bg-forum-card border border-forum-border rounded-lg p-4 text-center">
                        <p class="text-3xl font-bold text-yellow-400" x-text="bubbleCards.filter(c => c.health === '现金流支撑').length"></p>
                        <p class="text-sm text-gray-500 mt-1">现金流支撑</p>
                    </div>
                    <div class="bg-forum-card border border-forum-border rounded-lg p-4 text-center">
                        <p class="text-3xl font-bold text-green-400" x-text="bubbleCards.filter(c => c.health === '稳健融资').length"></p>
                        <p class="text-sm text-gray-500 mt-1">稳健融资</p>
                    </div>
                </div>

                <!-- Layer Filter -->
                <div class="flex flex-wrap gap-2 mb-6">
                    <button @click="bubbleFilter = ''"
                            :class="bubbleFilter === '' ? 'bg-forum-accent text-white border-forum-accent' : 'bg-forum-card text-gray-400 hover:text-white border-forum-border'"
                            class="px-3 py-1.5 rounded-lg text-sm border transition-colors">全部</button>
                    <button @click="bubbleFilter = 'Application'"
                            :class="bubbleFilter === 'Application' ? 'bg-blue-500/30 text-blue-400 border-blue-500/50' : 'bg-forum-card text-gray-400 hover:text-blue-400 border-forum-border'"
                            class="px-3 py-1.5 rounded-lg text-sm border transition-colors">应用层</button>
                    <button @click="bubbleFilter = 'Model'"
                            :class="bubbleFilter === 'Model' ? 'bg-purple-500/30 text-purple-400 border-purple-500/50' : 'bg-forum-card text-gray-400 hover:text-purple-400 border-forum-border'"
                            class="px-3 py-1.5 rounded-lg text-sm border transition-colors">模型层</button>
                    <button @click="bubbleFilter = 'Infrastructure'"
                            :class="bubbleFilter === 'Infrastructure' ? 'bg-orange-500/30 text-orange-400 border-orange-500/50' : 'bg-forum-card text-gray-400 hover:text-orange-400 border-forum-border'"
                            class="px-3 py-1.5 rounded-lg text-sm border transition-colors">基础设施</button>
                </div>

                <!-- Card Grid -->
                <div x-show="!loading && deals.length > 0" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    <template x-for="card in filteredBubbleCards" :key="card.id">
                        <div @click="openDealModal(card)"
                             class="bg-forum-card border border-forum-border rounded-lg p-3 hover:border-forum-accent/50 transition-all cursor-pointer group">
                            <!-- Company Name -->
                            <h4 class="text-sm font-semibold text-white truncate mb-2" x-text="card.company"></h4>

                            <!-- Badges -->
                            <div class="flex flex-wrap gap-1 mb-3">
                                <span class="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                                      :class="card.layerColor === 'blue' ? 'bg-blue-500/20 text-blue-400' : card.layerColor === 'purple' ? 'bg-purple-500/20 text-purple-400' : 'bg-orange-500/20 text-orange-400'"
                                      x-text="card.layerLabel"></span>
                                <span class="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                                      :class="card.healthColor === 'green' ? 'bg-green-500/20 text-green-400' : card.healthColor === 'yellow' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'"
                                      x-text="card.health"></span>
                            </div>

                            <!-- Metrics -->
                            <div class="space-y-1 text-xs text-gray-500">
                                <div class="flex justify-between">
                                    <span>现金流</span>
                                    <span class="text-white font-medium" x-text="card.runway + ' mo'"></span>
                                </div>
                                <div class="flex justify-between">
                                    <span>泡沫指数</span>
                                    <span class="font-bold"
                                          :class="card.bubbleMultiple >= 3 ? 'text-red-400' : card.bubbleMultiple >= 1.5 ? 'text-yellow-400' : 'text-green-400'"
                                          x-text="card.bubbleMultiple + 'x'"></span>
                                </div>
                            </div>

                            <!-- Amount -->
                            <div class="mt-2 pt-2 border-t border-forum-border">
                                <p class="text-[10px] text-gray-600" x-text="card.round"></p>
                                <p class="text-sm font-bold text-forum-accent" x-text="'$' + formatNumber(card.amount_usd)"></p>
                            </div>
                        </div>
                    </template>
                </div>

                <!-- Empty -->
                <div x-show="!loading && deals.length === 0" class="text-center py-12 text-gray-500">
                    <p class="text-4xl mb-4">&#x1FAE7;</p>
                    <p>No deals to monitor yet.</p>
                </div>

                <!-- Loading -->
                <div x-show="loading" class="text-center py-12">
                    <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-forum-accent"></div>
                    <p class="mt-2 text-gray-500">Loading bubble data...</p>
                </div>
            </div>

            <!-- Challenges View -->
            <div x-show="currentView === 'challenges'" x-cloak>
                <div class="text-center py-12 text-gray-500">
                    <h2 class="text-xl font-semibold mb-4">Weekly Challenges</h2>
                    <p>Build alternatives to overpriced solutions</p>
                    <p class="mt-4">Coming soon...</p>
                </div>
            </div>

            <!-- Leaderboard View -->
            <div x-show="currentView === 'leaderboard'" x-cloak x-init="$watch('currentView', val => val === 'leaderboard' && fetchLeaderboard())">
                <div class="mb-6">
                    <h2 class="text-xl font-semibold mb-2">🏆 Most Overpriced Deals</h2>
                    <p class="text-gray-500">Ranked by average community Overpriced Score</p>
                </div>

                <!-- Loading -->
                <div x-show="leaderboardLoading" class="text-center py-12">
                    <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-forum-accent"></div>
                    <p class="mt-2 text-gray-500">Loading leaderboard...</p>
                </div>

                <!-- Leaderboard Table -->
                <div x-show="!leaderboardLoading && leaderboardData.length > 0" class="space-y-3">
                    <template x-for="(item, index) in leaderboardData" :key="item.id">
                        <div @click="openDealModal(item)" 
                             class="bg-forum-card border border-forum-border rounded-lg p-4 hover:border-forum-accent/50 transition-all cursor-pointer flex items-center gap-4">
                            <!-- Rank -->
                            <div class="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-full"
                                 :class="index === 0 ? 'bg-yellow-500/20 text-yellow-400' : index === 1 ? 'bg-gray-400/20 text-gray-300' : index === 2 ? 'bg-orange-600/20 text-orange-400' : 'bg-forum-border text-gray-500'">
                                <span class="text-lg font-bold" x-text="'#' + (index + 1)"></span>
                            </div>
                            
                            <!-- Company Info -->
                            <div class="flex-1 min-w-0">
                                <h3 class="text-lg font-semibold text-white truncate" x-text="item.company"></h3>
                                <div class="flex items-center gap-3 mt-1 text-sm text-gray-500">
                                    <span x-text="item.round"></span>
                                    <span>•</span>
                                    <span class="text-green-400" x-text="'$' + formatNumber(item.amount_usd)"></span>
                                    <span>•</span>
                                    <span x-text="item.analysis_count + ' analyses'"></span>
                                </div>
                            </div>
                            
                            <!-- Scores -->
                            <div class="flex-shrink-0 flex items-center gap-4">
                                <!-- Average Overpriced Score -->
                                <div class="text-center">
                                    <div class="relative w-14 h-14">
                                        <svg class="w-full h-full transform -rotate-90">
                                            <circle cx="28" cy="28" r="24" stroke="#2a2a2a" stroke-width="4" fill="none"/>
                                            <circle cx="28" cy="28" r="24" 
                                                    :stroke="item.avg_overpriced >= 7 ? '#ff4444' : item.avg_overpriced >= 4 ? '#facc15' : '#4ade80'"
                                                    stroke-width="4" fill="none"
                                                    stroke-linecap="round"
                                                    :stroke-dasharray="(item.avg_overpriced / 10) * 151 + ' 151'"/>
                                        </svg>
                                        <span class="absolute inset-0 flex items-center justify-center text-lg font-bold"
                                              :class="item.avg_overpriced >= 7 ? 'text-forum-accent' : item.avg_overpriced >= 4 ? 'text-yellow-400' : 'text-green-400'"
                                              x-text="item.avg_overpriced"></span>
                                    </div>
                                    <p class="text-xs text-gray-500 mt-1">Overpriced</p>
                                </div>
                                
                                <!-- AI Replaceability -->
                                <div class="text-center hidden sm:block">
                                    <div class="relative w-14 h-14">
                                        <svg class="w-full h-full transform -rotate-90">
                                            <circle cx="28" cy="28" r="24" stroke="#2a2a2a" stroke-width="4" fill="none"/>
                                            <circle cx="28" cy="28" r="24" stroke="#c084fc" stroke-width="4" fill="none"
                                                    stroke-linecap="round"
                                                    :stroke-dasharray="(item.avg_ai_replaceability / 10) * 151 + ' 151'"/>
                                        </svg>
                                        <span class="absolute inset-0 flex items-center justify-center text-lg font-bold text-purple-400"
                                              x-text="item.avg_ai_replaceability || '-'"></span>
                                    </div>
                                    <p class="text-xs text-gray-500 mt-1">AI Replace</p>
                                </div>
                            </div>
                        </div>
                    </template>
                </div>

                <!-- Empty State -->
                <div x-show="!leaderboardLoading && leaderboardData.length === 0" class="text-center py-12 text-gray-500">
                    <p class="text-4xl mb-4">📊</p>
                    <p>No deals have been analyzed yet.</p>
                    <p class="mt-2">Be the first to submit an analysis!</p>
                </div>
            </div>
        </main>

        <!-- Deal Detail Modal -->
        <div x-show="showModal" x-cloak 
             class="fixed inset-0 z-50 flex items-center justify-center p-4"
             @keydown.escape.window="closeModal()">
            <!-- Backdrop -->
            <div class="absolute inset-0 bg-black/80" @click="closeModal()"></div>
            
            <!-- Modal Content -->
            <div class="relative bg-forum-card border border-forum-border rounded-xl max-w-2xl w-full max-h-[85vh] overflow-hidden"
                 x-transition:enter="transition ease-out duration-200"
                 x-transition:enter-start="opacity-0 scale-95"
                 x-transition:enter-end="opacity-100 scale-100">
                
                <!-- Loading State -->
                <div x-show="modalLoading" class="p-12 text-center">
                    <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-forum-accent"></div>
                    <p class="mt-2 text-gray-500">Loading deal details...</p>
                </div>

                <!-- Deal Content -->
                <div x-show="!modalLoading && selectedDeal" class="overflow-y-auto max-h-[85vh]">
                    <!-- Header -->
                    <div class="sticky top-0 bg-forum-card border-b border-forum-border p-6">
                        <div class="flex items-start justify-between">
                            <div>
                                <h2 class="text-2xl font-bold text-white" x-text="selectedDeal?.company"></h2>
                                <div class="flex items-center gap-3 mt-2">
                                    <span class="bg-forum-accent/20 text-forum-accent px-3 py-1 rounded-full text-sm" x-text="selectedDeal?.round"></span>
                                    <span class="text-xl font-semibold text-green-400" x-text="'$' + formatNumber(selectedDeal?.amount_usd || 0)"></span>
                                </div>
                            </div>
                            <button @click="closeModal()" class="text-gray-500 hover:text-white transition-colors">
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                                </svg>
                            </button>
                        </div>
                        <div class="mt-4 flex items-center gap-4 text-sm">
                            <span class="text-gray-500" x-text="'Added ' + formatDate(selectedDeal?.created_at)"></span>
                            <a x-show="selectedDeal?.source_url" :href="selectedDeal?.source_url" target="_blank" 
                               class="text-blue-400 hover:text-blue-300 transition-colors">
                                View Source →
                            </a>
                        </div>
                    </div>

                    <!-- Analyses Section -->
                    <div class="p-6">
                        <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
                            <span>🔍 Community Analyses</span>
                            <span class="bg-forum-border text-gray-400 px-2 py-0.5 rounded text-sm" 
                                  x-text="(selectedDeal?.analyses?.length || 0) + ' analysis'"></span>
                        </h3>

                        <!-- Submit Analysis Button -->
                        <div x-show="!showAnalysisForm" class="mb-4">
                            <button @click="showAnalysisForm = true; submitError = null" 
                                    class="bg-forum-accent hover:bg-forum-accent/80 text-white px-4 py-2 rounded-lg transition-colors">
                                + Submit Analysis
                            </button>
                        </div>

                        <!-- Analysis Form -->
                        <div x-show="showAnalysisForm" x-cloak class="bg-forum-bg border border-forum-border rounded-lg p-4 mb-4">
                            <h4 class="text-md font-semibold mb-4">Submit Your Analysis</h4>
                            
                            <!-- Error Message -->
                            <div x-show="submitError" class="bg-red-900/20 border border-red-800 rounded-lg p-3 mb-4">
                                <p class="text-red-400 text-sm" x-text="submitError"></p>
                            </div>

                            <form @submit.prevent="submitAnalysis()">
                                <!-- Author -->
                                <div class="mb-4">
                                    <label class="block text-sm text-gray-400 mb-1">Your Name</label>
                                    <input type="text" x-model="analysisForm.author" required
                                           placeholder="e.g. Anonymous Analyst"
                                           class="w-full bg-forum-card border border-forum-border rounded-lg px-3 py-2 text-forum-text placeholder-gray-600 focus:outline-none focus:border-forum-accent/50">
                                </div>

                                <!-- Scores Grid -->
                                <div class="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label class="block text-sm text-gray-400 mb-1">
                                            Overpriced Score <span class="text-forum-accent" x-text="analysisForm.overpriced_score"></span>/10
                                        </label>
                                        <input type="range" x-model="analysisForm.overpriced_score" min="1" max="10" step="1"
                                               class="w-full accent-forum-accent">
                                        <p class="text-xs text-gray-600">How overpriced is this deal?</p>
                                    </div>
                                    <div>
                                        <label class="block text-sm text-gray-400 mb-1">
                                            Tech Complexity <span class="text-blue-400" x-text="analysisForm.tech_complexity"></span>/10
                                        </label>
                                        <input type="range" x-model="analysisForm.tech_complexity" min="1" max="10" step="1"
                                               class="w-full accent-blue-400">
                                        <p class="text-xs text-gray-600">How hard is the tech to build?</p>
                                    </div>
                                    <div>
                                        <label class="block text-sm text-gray-400 mb-1">
                                            AI Replaceability <span class="text-purple-400" x-text="analysisForm.ai_replaceability"></span>/10
                                        </label>
                                        <input type="range" x-model="analysisForm.ai_replaceability" min="1" max="10" step="1"
                                               class="w-full accent-purple-400">
                                        <p class="text-xs text-gray-600">Can AI easily replicate this?</p>
                                    </div>
                                    <div>
                                        <label class="block text-sm text-gray-400 mb-1">
                                            Moat Score <span class="text-orange-400" x-text="analysisForm.moat_assessment"></span>/10
                                        </label>
                                        <input type="range" x-model="analysisForm.moat_assessment" min="1" max="10" step="1"
                                               class="w-full accent-orange-400">
                                        <p class="text-xs text-gray-600">How defensible is the business?</p>
                                    </div>
                                </div>

                                <!-- Analysis Content -->
                                <div class="mb-4">
                                    <label class="block text-sm text-gray-400 mb-1">Your Analysis</label>
                                    <textarea x-model="analysisForm.content" required rows="4"
                                              placeholder="Why do you think this deal is over/under priced? What's your take on the valuation?"
                                              class="w-full bg-forum-card border border-forum-border rounded-lg px-3 py-2 text-forum-text placeholder-gray-600 focus:outline-none focus:border-forum-accent/50 resize-none"></textarea>
                                </div>

                                <!-- Buttons -->
                                <div class="flex gap-2">
                                    <button type="submit" :disabled="submitting"
                                            class="bg-forum-accent hover:bg-forum-accent/80 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
                                        <span x-show="submitting" class="inline-block animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                                        <span x-text="submitting ? 'Submitting...' : 'Submit'"></span>
                                    </button>
                                    <button type="button" @click="showAnalysisForm = false; resetForm()"
                                            class="bg-forum-border hover:bg-forum-border/80 text-gray-300 px-4 py-2 rounded-lg transition-colors">
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>

                        <!-- No Analyses -->
                        <div x-show="!selectedDeal?.analyses?.length && !showAnalysisForm" class="bg-forum-bg border border-forum-border rounded-lg p-8 text-center">
                            <p class="text-gray-500">No analyses yet. Be the first to evaluate this deal!</p>
                        </div>

                        <!-- Analyses List -->
                        <div x-show="selectedDeal?.analyses?.length" class="space-y-4">
                            <template x-for="analysis in selectedDeal?.analyses || []" :key="analysis.id">
                                <div class="bg-forum-bg border border-forum-border rounded-lg p-4">
                                    <div class="flex items-center justify-between mb-3">
                                        <span class="text-sm text-gray-400">by <span class="text-white" x-text="analysis.author"></span></span>
                                        <span class="text-xs text-gray-600" x-text="formatDate(analysis.created_at)"></span>
                                    </div>
                                    
                                    <!-- Scores with Progress Bars -->
                                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                                        <div class="text-center">
                                            <div class="relative w-16 h-16 mx-auto mb-1">
                                                <svg class="w-full h-full transform -rotate-90">
                                                    <circle cx="32" cy="32" r="28" stroke="#2a2a2a" stroke-width="4" fill="none"/>
                                                    <circle cx="32" cy="32" r="28" 
                                                            :stroke="analysis.overpriced_score >= 7 ? '#ff4444' : analysis.overpriced_score >= 4 ? '#facc15' : '#4ade80'"
                                                            stroke-width="4" fill="none"
                                                            stroke-linecap="round"
                                                            :stroke-dasharray="(analysis.overpriced_score / 10) * 176 + ' 176'"/>
                                                </svg>
                                                <span class="absolute inset-0 flex items-center justify-center text-lg font-bold"
                                                      :class="analysis.overpriced_score >= 7 ? 'text-forum-accent' : analysis.overpriced_score >= 4 ? 'text-yellow-400' : 'text-green-400'"
                                                      x-text="analysis.overpriced_score"></span>
                                            </div>
                                            <p class="text-xs text-gray-500">Overpriced</p>
                                        </div>
                                        <div class="text-center">
                                            <div class="relative w-16 h-16 mx-auto mb-1">
                                                <svg class="w-full h-full transform -rotate-90">
                                                    <circle cx="32" cy="32" r="28" stroke="#2a2a2a" stroke-width="4" fill="none"/>
                                                    <circle cx="32" cy="32" r="28" stroke="#60a5fa" stroke-width="4" fill="none"
                                                            stroke-linecap="round"
                                                            :stroke-dasharray="(analysis.tech_complexity / 10) * 176 + ' 176'"/>
                                                </svg>
                                                <span class="absolute inset-0 flex items-center justify-center text-lg font-bold text-blue-400"
                                                      x-text="analysis.tech_complexity"></span>
                                            </div>
                                            <p class="text-xs text-gray-500">Tech Complexity</p>
                                        </div>
                                        <div class="text-center">
                                            <div class="relative w-16 h-16 mx-auto mb-1">
                                                <svg class="w-full h-full transform -rotate-90">
                                                    <circle cx="32" cy="32" r="28" stroke="#2a2a2a" stroke-width="4" fill="none"/>
                                                    <circle cx="32" cy="32" r="28" stroke="#c084fc" stroke-width="4" fill="none"
                                                            stroke-linecap="round"
                                                            :stroke-dasharray="(analysis.ai_replaceability / 10) * 176 + ' 176'"/>
                                                </svg>
                                                <span class="absolute inset-0 flex items-center justify-center text-lg font-bold text-purple-400"
                                                      x-text="analysis.ai_replaceability"></span>
                                            </div>
                                            <p class="text-xs text-gray-500">AI Replaceable</p>
                                        </div>
                                        <div class="text-center">
                                            <div class="relative w-16 h-16 mx-auto mb-1">
                                                <svg class="w-full h-full transform -rotate-90">
                                                    <circle cx="32" cy="32" r="28" stroke="#2a2a2a" stroke-width="4" fill="none"/>
                                                    <circle cx="32" cy="32" r="28" stroke="#fb923c" stroke-width="4" fill="none"
                                                            stroke-linecap="round"
                                                            :stroke-dasharray="(analysis.moat_assessment / 10) * 176 + ' 176'"/>
                                                </svg>
                                                <span class="absolute inset-0 flex items-center justify-center text-lg font-bold text-orange-400"
                                                      x-text="analysis.moat_assessment"></span>
                                            </div>
                                            <p class="text-xs text-gray-500">Moat Score</p>
                                        </div>
                                    </div>
                                    
                                    <!-- Content -->
                                    <p class="text-gray-300 text-sm leading-relaxed" x-text="analysis.content"></p>
                                </div>
                            </template>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        function app() {
            return {
                currentView: 'deals',
                deals: [],
                loading: false,
                error: null,
                searchQuery: '',
                roundFilter: '',
                sortBy: 'date',
                showModal: false,
                modalLoading: false,
                selectedDeal: null,
                showAnalysisForm: false,
                submitting: false,
                submitError: null,
                analysisForm: {
                    author: '',
                    content: '',
                    overpriced_score: 5,
                    tech_complexity: 5,
                    ai_replaceability: 5,
                    moat_assessment: 5
                },
                leaderboardData: [],
                leaderboardLoading: false,
                bubbleFilter: '',

                normalizeRound(round) {
                    if (round.includes('Pre-Seed') || round.includes('Pre Seed')) return 'Pre-Seed';
                    if (round.includes('Seed')) return 'Seed';
                    if (round.includes('Series A')) return 'Series A';
                    if (round.includes('Series B')) return 'Series B';
                    if (round.includes('Series C') || round.includes('Series D') || round.includes('Series E') || round.includes('Series F')) return 'Series C';
                    return 'Seed';
                },

                get bubbleCards() {
                    const thresholds = {
                        'Pre-Seed': { normal: 5000000, speculative: 15000000, burn: 80000, median: 2000000 },
                        'Seed': { normal: 15000000, speculative: 40000000, burn: 250000, median: 8000000 },
                        'Series A': { normal: 50000000, speculative: 120000000, burn: 800000, median: 25000000 },
                        'Series B': { normal: 150000000, speculative: 400000000, burn: 2500000, median: 80000000 },
                        'Series C': { normal: 500000000, speculative: 1000000000, burn: 7000000, median: 250000000 }
                    };

                    return this.deals.map(deal => {
                        const amount = deal.amount_usd || 0;
                        const roundKey = this.normalizeRound(deal.round || '');
                        const t = thresholds[roundKey];

                        let layer, layerLabel, layerColor;
                        if (amount > 200000000) {
                            layer = 'Infrastructure'; layerLabel = '基础设施'; layerColor = 'orange';
                        } else if (amount > 50000000) {
                            layer = 'Model'; layerLabel = '模型层'; layerColor = 'purple';
                        } else {
                            layer = 'Application'; layerLabel = '应用层'; layerColor = 'blue';
                        }

                        let health, healthColor;
                        if (amount > t.speculative) {
                            health = '投机融资'; healthColor = 'red';
                        } else if (amount > t.normal) {
                            health = '现金流支撑'; healthColor = 'yellow';
                        } else {
                            health = '稳健融资'; healthColor = 'green';
                        }

                        const runway = Math.min(Math.round(amount / t.burn), 99);
                        const bubbleMultiple = (amount / t.median).toFixed(1);

                        return {
                            ...deal,
                            layer, layerLabel, layerColor,
                            health, healthColor,
                            runway, bubbleMultiple
                        };
                    });
                },

                get filteredBubbleCards() {
                    if (!this.bubbleFilter) return this.bubbleCards;
                    return this.bubbleCards.filter(c => c.layer === this.bubbleFilter);
                },

                get filteredDeals() {
                    let result = [...this.deals];
                    
                    // Search filter
                    if (this.searchQuery.trim()) {
                        const query = this.searchQuery.toLowerCase();
                        result = result.filter(deal => 
                            deal.company.toLowerCase().includes(query)
                        );
                    }
                    
                    // Round filter
                    if (this.roundFilter) {
                        if (this.roundFilter === 'Series C') {
                            result = result.filter(deal => 
                                deal.round.includes('Series C') || 
                                deal.round.includes('Series D') || 
                                deal.round.includes('Series E')
                            );
                        } else {
                            result = result.filter(deal => deal.round === this.roundFilter);
                        }
                    }
                    
                    // Sort
                    if (this.sortBy === 'amount_desc') {
                        result.sort((a, b) => (b.amount_usd || 0) - (a.amount_usd || 0));
                    } else if (this.sortBy === 'amount_asc') {
                        result.sort((a, b) => (a.amount_usd || 0) - (b.amount_usd || 0));
                    } else {
                        result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                    }
                    
                    return result;
                },

                async fetchDeals() {
                    this.loading = true;
                    this.error = null;
                    try {
                        const response = await fetch('/api/v1/deals');
                        const data = await response.json();
                        if (data.success) {
                            this.deals = data.data || [];
                            // Render charts after data loads
                            this.$nextTick(() => {
                                this.renderFundingChart();
                                this.renderRoundChart();
                            });
                        } else {
                            throw new Error(data.error || 'Failed to fetch deals');
                        }
                    } catch (err) {
                        this.error = err.message || 'Failed to load deals. Please try again later.';
                        console.error('Error fetching deals:', err);
                    } finally {
                        this.loading = false;
                    }
                },

                formatNumber(num) {
                    return new Intl.NumberFormat('en-US', {
                        notation: 'compact',
                        maximumFractionDigits: 1
                    }).format(num);
                },

                formatDate(dateStr) {
                    const date = new Date(dateStr);
                    const now = new Date();
                    const diffMs = now - date;
                    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                    
                    if (diffDays === 0) return 'Today';
                    if (diffDays === 1) return 'Yesterday';
                    if (diffDays < 7) return \`\${diffDays} days ago\`;
                    if (diffDays < 30) return \`\${Math.floor(diffDays / 7)} weeks ago\`;
                    return \`\${Math.floor(diffDays / 30)} months ago\`;
                },

                totalFunding() {
                    return this.deals.reduce((sum, deal) => sum + (deal.amount_usd || 0), 0);
                },

                dealsThisWeek() {
                    const oneWeekAgo = new Date();
                    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                    return this.deals.filter(deal => new Date(deal.created_at) >= oneWeekAgo).length;
                },

                fundingChart: null,
                roundChart: null,

                renderRoundChart() {
                    if (this.deals.length === 0) return;
                    
                    // Count deals by round
                    const roundCounts = {};
                    const roundOrder = ['Pre-Seed', 'Seed', 'Series A', 'Series B', 'Series C', 'Series D+', 'Other'];
                    
                    this.deals.forEach(deal => {
                        let round = deal.round || 'Other';
                        // Normalize round names
                        if (round.includes('Pre-Seed') || round.includes('Pre Seed')) round = 'Pre-Seed';
                        else if (round.includes('Seed') && !round.includes('Pre')) round = 'Seed';
                        else if (round.includes('Series A')) round = 'Series A';
                        else if (round.includes('Series B')) round = 'Series B';
                        else if (round.includes('Series C')) round = 'Series C';
                        else if (round.includes('Series D') || round.includes('Series E') || round.includes('Series F')) round = 'Series D+';
                        else if (!roundOrder.includes(round)) round = 'Other';
                        
                        roundCounts[round] = (roundCounts[round] || 0) + 1;
                    });
                    
                    // Sort by round order and filter out zeros
                    const labels = roundOrder.filter(r => roundCounts[r] > 0);
                    const data = labels.map(r => roundCounts[r]);
                    
                    const ctx = document.getElementById('roundChart');
                    if (!ctx) return;
                    
                    if (this.roundChart) {
                        this.roundChart.destroy();
                    }
                    
                    const colors = [
                        '#a855f7', // Pre-Seed - purple
                        '#22c55e', // Seed - green
                        '#3b82f6', // Series A - blue
                        '#f59e0b', // Series B - amber
                        '#ef4444', // Series C - red
                        '#ec4899', // Series D+ - pink
                        '#6b7280'  // Other - gray
                    ];
                    
                    this.roundChart = new Chart(ctx, {
                        type: 'doughnut',
                        data: {
                            labels: labels,
                            datasets: [{
                                data: data,
                                backgroundColor: labels.map((_, i) => colors[roundOrder.indexOf(labels[i])] || colors[6]),
                                borderColor: '#1a1a1a',
                                borderWidth: 2
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            cutout: '50%',
                            plugins: {
                                legend: {
                                    display: true,
                                    position: 'right',
                                    labels: {
                                        color: '#9ca3af',
                                        usePointStyle: true,
                                        pointStyle: 'circle',
                                        padding: 12,
                                        font: { size: 11 }
                                    }
                                },
                                tooltip: {
                                    callbacks: {
                                        label: (ctx) => {
                                            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                                            const pct = ((ctx.raw / total) * 100).toFixed(1);
                                            return \`\${ctx.label}: \${ctx.raw} (\${pct}%)\`;
                                        }
                                    }
                                }
                            }
                        }
                    });
                },

                renderFundingChart() {
                    if (this.deals.length === 0) return;
                    
                    // Group deals by month
                    const monthlyData = {};
                    this.deals.forEach(deal => {
                        const date = new Date(deal.created_at);
                        const key = \`\${date.getFullYear()}-\${String(date.getMonth() + 1).padStart(2, '0')}\`;
                        if (!monthlyData[key]) {
                            monthlyData[key] = { amount: 0, count: 0 };
                        }
                        monthlyData[key].amount += deal.amount_usd || 0;
                        monthlyData[key].count += 1;
                    });
                    
                    // Sort by date and take last 6 months
                    const sortedMonths = Object.keys(monthlyData).sort().slice(-6);
                    const labels = sortedMonths.map(m => {
                        const [year, month] = m.split('-');
                        return new Date(year, parseInt(month) - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                    });
                    const amounts = sortedMonths.map(m => monthlyData[m].amount / 1000000);
                    const counts = sortedMonths.map(m => monthlyData[m].count);
                    
                    const ctx = document.getElementById('fundingChart');
                    if (!ctx) return;
                    
                    // Destroy existing chart
                    if (this.fundingChart) {
                        this.fundingChart.destroy();
                    }
                    
                    this.fundingChart = new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: labels,
                            datasets: [{
                                label: 'Funding ($M)',
                                data: amounts,
                                backgroundColor: 'rgba(255, 68, 68, 0.6)',
                                borderColor: '#ff4444',
                                borderWidth: 1,
                                borderRadius: 4,
                                yAxisID: 'y'
                            }, {
                                label: 'Deals',
                                data: counts,
                                type: 'line',
                                borderColor: '#60a5fa',
                                backgroundColor: 'rgba(96, 165, 250, 0.1)',
                                borderWidth: 2,
                                pointBackgroundColor: '#60a5fa',
                                pointRadius: 4,
                                tension: 0.3,
                                yAxisID: 'y1'
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            interaction: {
                                mode: 'index',
                                intersect: false
                            },
                            plugins: {
                                legend: {
                                    display: true,
                                    position: 'top',
                                    labels: {
                                        color: '#9ca3af',
                                        usePointStyle: true,
                                        padding: 15
                                    }
                                }
                            },
                            scales: {
                                x: {
                                    grid: { color: '#2a2a2a' },
                                    ticks: { color: '#9ca3af' }
                                },
                                y: {
                                    type: 'linear',
                                    position: 'left',
                                    grid: { color: '#2a2a2a' },
                                    ticks: { 
                                        color: '#ff4444',
                                        callback: (val) => '$' + val + 'M'
                                    },
                                    title: {
                                        display: false
                                    }
                                },
                                y1: {
                                    type: 'linear',
                                    position: 'right',
                                    grid: { drawOnChartArea: false },
                                    ticks: { 
                                        color: '#60a5fa',
                                        stepSize: 1
                                    },
                                    title: {
                                        display: false
                                    }
                                }
                            }
                        }
                    });
                },

                async openDealModal(deal) {
                    this.showModal = true;
                    this.modalLoading = true;
                    this.selectedDeal = null;
                    
                    try {
                        const response = await fetch(\`/api/v1/deals/\${deal.id}\`);
                        const data = await response.json();
                        if (data.success) {
                            this.selectedDeal = data.data;
                        } else {
                            throw new Error(data.error || 'Failed to fetch deal');
                        }
                    } catch (err) {
                        console.error('Error fetching deal:', err);
                        this.selectedDeal = { ...deal, analyses: [] };
                    } finally {
                        this.modalLoading = false;
                    }
                },

                closeModal() {
                    this.showModal = false;
                    this.selectedDeal = null;
                    this.showAnalysisForm = false;
                    this.resetForm();
                },

                resetForm() {
                    this.analysisForm = {
                        author: '',
                        content: '',
                        overpriced_score: 5,
                        tech_complexity: 5,
                        ai_replaceability: 5,
                        moat_assessment: 5
                    };
                    this.submitError = null;
                },

                async fetchLeaderboard() {
                    if (this.leaderboardData.length > 0) return; // Already loaded
                    this.leaderboardLoading = true;
                    try {
                        const response = await fetch('/api/v1/leaderboard');
                        const data = await response.json();
                        if (data.success) {
                            this.leaderboardData = data.data || [];
                        }
                    } catch (err) {
                        console.error('Error fetching leaderboard:', err);
                    } finally {
                        this.leaderboardLoading = false;
                    }
                },

                async submitAnalysis() {
                    if (!this.selectedDeal) return;
                    
                    this.submitting = true;
                    this.submitError = null;
                    
                    try {
                        const payload = {
                            deal_id: this.selectedDeal.id,
                            author: this.analysisForm.author.trim(),
                            content: this.analysisForm.content.trim(),
                            overpriced_score: parseInt(this.analysisForm.overpriced_score),
                            tech_complexity: parseInt(this.analysisForm.tech_complexity),
                            ai_replaceability: parseInt(this.analysisForm.ai_replaceability),
                            moat_assessment: parseInt(this.analysisForm.moat_assessment)
                        };

                        const response = await fetch('/api/v1/analyses', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });

                        const data = await response.json();
                        
                        if (!response.ok || !data.success) {
                            throw new Error(data.error || 'Failed to submit analysis');
                        }

                        // Add the new analysis to the list
                        if (!this.selectedDeal.analyses) {
                            this.selectedDeal.analyses = [];
                        }
                        this.selectedDeal.analyses.unshift(data.data);
                        
                        // Reset form and hide it
                        this.showAnalysisForm = false;
                        this.resetForm();

                    } catch (err) {
                        console.error('Error submitting analysis:', err);
                        this.submitError = err.message || 'Failed to submit. Please try again.';
                    } finally {
                        this.submitting = false;
                    }
                }
            }
        }
    </script>
</body>
</html>`
