export const indexHtml = `
<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Overpriseed - Exposing Overpriced Startup Deals</title>
    <script src="https://cdn.tailwindcss.com"></script>
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
                    <nav class="flex gap-6">
                        <a href="#" @click.prevent="currentView = 'deals'" 
                           :class="currentView === 'deals' ? 'text-forum-accent' : 'text-forum-text hover:text-forum-accent'" 
                           class="font-medium transition-colors">Deals</a>
                        <a href="#" @click.prevent="currentView = 'challenges'" 
                           :class="currentView === 'challenges' ? 'text-forum-accent' : 'text-forum-text hover:text-forum-accent'" 
                           class="font-medium transition-colors">Challenges</a>
                        <a href="#" @click.prevent="currentView = 'leaderboard'" 
                           :class="currentView === 'leaderboard' ? 'text-forum-accent' : 'text-forum-text hover:text-forum-accent'" 
                           class="font-medium transition-colors">Leaderboard</a>
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
                <div x-show="!loading && deals.length > 0" class="grid grid-cols-3 gap-4 mb-8">
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
                    if (diffDays < 7) return `${diffDays} days ago`;
                    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
                    return `${Math.floor(diffDays / 30)} months ago`;
                },

                totalFunding() {
                    return this.deals.reduce((sum, deal) => sum + (deal.amount_usd || 0), 0);
                },

                dealsThisWeek() {
                    const oneWeekAgo = new Date();
                    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                    return this.deals.filter(deal => new Date(deal.created_at) >= oneWeekAgo).length;
                },

                async openDealModal(deal) {
                    this.showModal = true;
                    this.modalLoading = true;
                    this.selectedDeal = null;
                    
                    try {
                        const response = await fetch(`/api/v1/deals/${deal.id}`);
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
</html>`;
