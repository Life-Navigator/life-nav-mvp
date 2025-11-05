// components/integrations/IntegrationCategoryTabs.tsx
interface Category {
    id: string;
    name: string;
    count: number;
  }
  
  interface IntegrationCategoryTabsProps {
    categories: Category[];
    activeCategory: string;
    onChange: (categoryId: string) => void;
  }
  
  export function IntegrationCategoryTabs({ 
    categories, 
    activeCategory, 
    onChange 
  }: IntegrationCategoryTabsProps) {
    return (
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {categories.map((category) => (
            <button
              key={category.id}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                ${activeCategory === category.id
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
              `}
              onClick={() => onChange(category.id)}
            >
              {category.name}
              <span className={`ml-2 py-0.5 px-2.5 rounded-full text-xs
                ${activeCategory === category.id
                  ? 'bg-indigo-100 text-indigo-600'
                  : 'bg-gray-100 text-gray-900'}
              `}>
                {category.count}
              </span>
            </button>
          ))}
        </nav>
      </div>
    );
  }