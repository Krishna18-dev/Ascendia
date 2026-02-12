import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { Header } from "@/components/Layout/Header";
import { Footer } from "@/components/Layout/Footer";
import { StudyLayout } from "@/components/StudyLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { FloatingThemeToggle } from "@/components/FloatingThemeToggle";
import { AnimatePresence, motion } from "framer-motion";
import Home from "./pages/Home";
import Tools from "./pages/Tools";
import Learn from "./pages/Learn";
import Chat from "./pages/Chat";
import Dashboard from "./pages/Dashboard";
import MockInterview from "./pages/MockInterview";
import FAQ from "./pages/FAQ";
import Privacy from "./pages/legal/Privacy";
import Roadmap from "./pages/Roadmap";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import Onboarding from "./pages/Onboarding";
import ChatPage from "./pages/study/ChatPage";
import ContentGenerator from "./pages/study/ContentGenerator";
import Interview from "./pages/study/Interview";
import LearningGames from "./pages/study/LearningGames";
import VideoNotes from "./pages/study/VideoNotes";

const queryClient = new QueryClient();

const PageWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      {children}
    </motion.div>
  );
};

const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Public routes with header/footer */}
        <Route
          path="/"
          element={
            <PageWrapper>
              <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1">
                  <Home />
                </main>
                <Footer />
              </div>
            </PageWrapper>
          }
        />
        <Route
          path="/tools"
          element={
            <ProtectedRoute>
              <PageWrapper>
                <div className="flex flex-col min-h-screen">
                  <Header />
                  <main className="flex-1">
                    <Tools />
                  </main>
                  <Footer />
                </div>
              </PageWrapper>
            </ProtectedRoute>
          }
        />
        <Route
          path="/learn"
          element={
            <ProtectedRoute>
              <PageWrapper>
                <div className="flex flex-col min-h-screen">
                  <Header />
                  <main className="flex-1">
                    <Learn />
                  </main>
                  <Footer />
                </div>
              </PageWrapper>
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <PageWrapper>
                <div className="flex flex-col min-h-screen">
                  <Header />
                  <main className="flex-1">
                    <Chat />
                  </main>
                  <Footer />
                </div>
              </PageWrapper>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <PageWrapper>
                <div className="flex flex-col min-h-screen">
                  <Header />
                  <main className="flex-1">
                    <Dashboard />
                  </main>
                  <Footer />
                </div>
              </PageWrapper>
            </ProtectedRoute>
          }
        />
        <Route
          path="/mock-interview"
          element={
            <ProtectedRoute>
              <PageWrapper>
                <div className="flex flex-col min-h-screen">
                  <Header />
                  <main className="flex-1">
                    <MockInterview />
                  </main>
                  <Footer />
                </div>
              </PageWrapper>
            </ProtectedRoute>
          }
        />
        <Route
          path="/roadmap"
          element={
            <ProtectedRoute>
              <PageWrapper>
                <div className="flex flex-col min-h-screen">
                  <Header />
                  <main className="flex-1">
                    <Roadmap />
                  </main>
                  <Footer />
                </div>
              </PageWrapper>
            </ProtectedRoute>
          }
        />
        <Route
          path="/faq"
          element={
            <PageWrapper>
              <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1">
                  <FAQ />
                </main>
                <Footer />
              </div>
            </PageWrapper>
          }
        />
        <Route
          path="/legal/privacy"
          element={
            <PageWrapper>
              <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1">
                  <Privacy />
                </main>
                <Footer />
              </div>
            </PageWrapper>
          }
        />
        <Route
          path="/auth"
          element={
            <PageWrapper>
              <Auth />
            </PageWrapper>
          }
        />
        <Route
          path="/onboarding"
          element={
            <PageWrapper>
              <Onboarding />
            </PageWrapper>
          }
        />

        {/* Study routes with sidebar (protected) */}
        <Route
          path="/study/chat"
          element={
            <PageWrapper>
              <StudyLayout>
                <ChatPage />
              </StudyLayout>
            </PageWrapper>
          }
        />
        <Route
          path="/study/content"
          element={
            <PageWrapper>
              <StudyLayout>
                <ContentGenerator />
              </StudyLayout>
            </PageWrapper>
          }
        />
        <Route
          path="/study/interview"
          element={
            <PageWrapper>
              <StudyLayout>
                <Interview />
              </StudyLayout>
            </PageWrapper>
          }
        />
        <Route
          path="/study/games"
          element={
            <PageWrapper>
              <StudyLayout>
                <LearningGames />
              </StudyLayout>
            </PageWrapper>
          }
        />
        <Route
          path="/study/video-notes"
          element={
            <PageWrapper>
              <StudyLayout>
                <VideoNotes />
              </StudyLayout>
            </PageWrapper>
          }
        />
        <Route
          path="/profile"
          element={
            <PageWrapper>
              <StudyLayout>
                <Profile />
              </StudyLayout>
            </PageWrapper>
          }
        />

        {/* Catch-all route */}
        <Route
          path="*"
          element={
            <PageWrapper>
              <NotFound />
            </PageWrapper>
          }
        />
      </Routes>
    </AnimatePresence>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="dark">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AnimatedRoutes />
            <FloatingThemeToggle />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
