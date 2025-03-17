
import React from 'react';
import { Layers, Zap, Shield, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import AnimatedIcon from './AnimatedIcon';
import { cn } from "@/lib/utils";

const features = [
  {
    icon: Layers,
    title: 'Modular Design',
    description: 'Build with composable components that maintain a consistent design language throughout your application.'
  },
  {
    icon: Zap,
    title: 'Lightning Fast',
    description: 'Optimized for performance with quick load times and smooth interactions that keep users engaged.'
  },
  {
    icon: Shield,
    title: 'Secure & Reliable',
    description: 'Built with security best practices to ensure your application and user data stays protected.'
  },
  {
    icon: RefreshCw,
    title: 'Continuous Updates',
    description: 'Regular improvements and new features that enhance functionality without disrupting your workflow.'
  }
];

const Features: React.FC = () => {
  return (
    <section id="features" className="section bg-muted/50">
      <div className="container-custom">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-block px-3 py-1 text-xs font-medium bg-primary/10 text-primary rounded-full mb-4">
            Core Features
          </span>
          <h2 className="text-3xl md:text-4xl font-semibold mb-4">
            Designed for Excellence
          </h2>
          <p className="text-muted-foreground text-lg">
            Our framework combines powerful features with an intuitive interface, making it the perfect foundation for your next project.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="card-hover border bg-card overflow-hidden">
              <CardHeader className="pb-2">
                <div className="mb-4 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <AnimatedIcon icon={feature.icon} size={24} className="text-primary" delay={index * 100} />
                </div>
                <CardTitle className="text-xl">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-muted-foreground">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
