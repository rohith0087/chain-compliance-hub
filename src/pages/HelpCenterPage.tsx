import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Headphones,
  Phone,
  Mail,
  Activity,
  Search,
  ArrowLeft,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { HelpRichText, helpPlainText } from '@/components/help/HelpRichText';
import { faqCategories } from '@/components/help/helpContent';

export default function HelpCenterPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredFAQs = useMemo(() => {
    if (!searchQuery.trim() && !selectedCategory) {
      return faqCategories;
    }

    const query = searchQuery.toLowerCase().trim();
    
    return faqCategories
      .filter(category => !selectedCategory || category.id === selectedCategory)
      .map(category => ({
        ...category,
        faqs: category.faqs.filter(
          faq =>
            faq.question.toLowerCase().includes(query) ||
            helpPlainText(faq.answer).toLowerCase().includes(query)
        )
      }))
      .filter(category => category.faqs.length > 0);
  }, [searchQuery, selectedCategory]);

  const totalFAQs = faqCategories.reduce((sum, cat) => sum + cat.faqs.length, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-primary via-primary/90 to-primary/80 text-primary-foreground">
        <div className="container mx-auto px-4 py-12">
          {/* Back Button */}
          <Button
            variant="ghost"
            className="mb-6 text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/20 mb-6">
              <Headphones className="h-8 w-8" />
            </div>
            <h1 className="text-4xl font-bold mb-4">Help Center</h1>
            <p className="text-lg text-primary-foreground/80 mb-8">
              Find answers, guides, and 24/7 support for your compliance operations
            </p>

            {/* Search Bar */}
            <div className="relative max-w-xl mx-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search help articles, documents, compliance, onboarding..."
                className="pl-12 h-14 text-base bg-white text-foreground border-0 shadow-lg"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        {/* 24/7 Support Hotline */}
        <Card className="mb-8 border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-14 h-14 rounded-full bg-primary/10">
                  <Phone className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">24/7 Support Hotline</p>
                  <p className="text-2xl font-bold text-foreground">+1 (769) 303-6507</p>
                </div>
              </div>
              <Button size="lg" asChild>
                <a href="tel:+17693036507" className="gap-2">
                  <Phone className="h-4 w-4" />
                  Call Now
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Contact Options Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
                <Phone className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Phone Support</h3>
              <p className="text-sm text-muted-foreground mb-4">Available 24/7 for urgent issues</p>
              <Button variant="outline" className="w-full" asChild>
                <a href="tel:+17693036507">Call Support</a>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Email Us</h3>
              <p className="text-sm text-muted-foreground mb-4">Response within 24 hours</p>
              <Button variant="outline" className="w-full" asChild>
                <a href="mailto:support@tracer2c.com">Send Email</a>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
                <Activity className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">System Status</h3>
              <p className="text-sm text-muted-foreground mb-4">Check platform availability</p>
              <Button variant="outline" className="w-full gap-2" asChild>
                <a href="https://status.tracer2c.com" target="_blank" rel="noopener noreferrer">
                  View Status
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* FAQ Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Frequently Asked Questions</h2>
            <Badge variant="secondary" className="text-sm">
              {totalFAQs} articles
            </Badge>
          </div>

          {/* Category Pills */}
          <div className="flex flex-wrap gap-2 mb-8">
            <Button
              variant={selectedCategory === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(null)}
              className="rounded-full"
            >
              All
              <Badge variant="secondary" className="ml-2 bg-white/20">
                {totalFAQs}
              </Badge>
            </Button>
            {faqCategories.map((category) => (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(category.id)}
                className="rounded-full"
              >
                <category.icon className="mr-1 h-3.5 w-3.5" />
                {category.name}
                <Badge variant="secondary" className="ml-2 bg-white/20">
                  {category.faqs.length}
                </Badge>
              </Button>
            ))}
          </div>

          {/* FAQ Accordions */}
          {filteredFAQs.length > 0 ? (
            <div className="space-y-6">
              {filteredFAQs.map((category) => (
                <Card key={category.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                        <category.icon className="h-4 w-4 text-primary" />
                      </span>
                      {category.name}
                      <Badge variant="outline" className="ml-auto">
                        {category.faqs.length} questions
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Accordion type="single" collapsible className="w-full">
                      {category.faqs.map((faq, index) => (
                        <AccordionItem key={index} value={`${category.id}-${index}`}>
                          <AccordionTrigger className="text-left hover:no-underline">
                            <span className="flex items-center gap-2">
                              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
                              {faq.question}
                            </span>
                          </AccordionTrigger>
                          <AccordionContent className="pl-6 pr-2">
                            <HelpRichText content={faq.answer} />
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No results found</h3>
              <p className="text-muted-foreground mb-6">
                We couldn't find any articles matching "{searchQuery}"
              </p>
              <div className="flex justify-center gap-4">
                <Button variant="outline" onClick={() => setSearchQuery('')}>
                  Clear Search
                </Button>
                <Button asChild>
                  <a href="tel:+17693036507">
                    <Phone className="h-4 w-4 mr-2" />
                    Call Support
                  </a>
                </Button>
              </div>
            </Card>
          )}
        </div>

        {/* Bottom CTA */}
        <Card className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-8 text-center">
            <h3 className="text-xl font-bold mb-2">Can't find what you need?</h3>
            <p className="text-muted-foreground mb-6">
              Our team is here to help 24/7. Reach out through any channel.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button variant="outline" asChild>
                <a href="mailto:support@tracer2c.com" className="gap-2">
                  <Mail className="h-4 w-4" />
                  Email Support
                </a>
              </Button>
              <Button asChild>
                <a href="tel:+17693036507" className="gap-2">
                  <Phone className="h-4 w-4" />
                  Call +1 (769) 303-6507
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
