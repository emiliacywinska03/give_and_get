import React from "react";

const Main: React.FC = () => {
    return(
        <main>
            <section className="about">
                <div className="container about-content">
                    <h1 className="about-title">
                        Znajdź to co potrzebujesz, sprzedaj to czego nie potrzebujesz
                    </h1>
                    <p className="about-description">
                        Przeglądaj tysiące ogłoszeń w kategoriach: praca, sprzedaż i usługi.
                    </p>
                    <div className="about-buttons">
                        <a href="/listings/create" className="button-add-listing">Dodaj ogłoszenie</a>
                        <a href="/listings" className="button-search-listing">Przeglądaj ogłoszenia</a>
                    </div>
                </div>
            </section>

            <section className="categories">
                <h1 className="categories-title">Kategorie</h1>
                <p className="categories-description">
                    Przeglądaj ogłoszenia według kategorii, aby znaleźć dokładnie to czego szukasz.
                </p>
                <div className="categories">
                    <CategoryCard
                        svg={
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width={130} height={130}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0M12 12.75h.008v.008H12v-.008Z" />
                            </svg>
                        }
                        title="Praca"
                        description="Znajdź pracę lub zatrudnij talenty"
                        link="/listings/category/work"
                    />
                    <CategoryCard
                        svg={
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width={130} height={130}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
                            </svg>
                          }
                          title="Sprzedaż"
                          description="Kupuj i sprzedawaj przedmioty"
                          link="/listings/category/sales"
                    />
                    <CategoryCard
                        svg={
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width={130} height={130}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                            </svg>
                        }
                        title="Pomoc"
                        description="Oferuj lub poszukuj pomocy"
                        link="/listings/category/help"
                    />
                </div>
            </section>
        </main>
    )
}

interface CategoryCardProps {
    svg: React.ReactNode;
    title: string;
    description: string;
    link: string;
}

const CategoryCard: React.FC<CategoryCardProps> = ({svg, title, description, link}) => (
    <div className="category-card">
        <div className="category-icon">{svg}</div>
        <h3 className="category-title">{title}</h3>
        <p className="category-description">{description}</p>
        <a href={link} className="button button-outline">Przeglądaj {title}</a>
    </div>
)

export default Main;